const crypto = require('crypto');
const prisma = require('../../config/prisma');
const { generateOtp, otpExpiresAt } = require('../../utils/otp');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../../utils/jwt');
const { sendOtpSms } = require('../../utils/sms');
const { NODE_ENV } = require('../../config/env');

const MAX_OTP_ATTEMPTS = 3;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

// Refresh tokens are stored hashed in the Session table so a DB leak can't yield usable tokens.
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// Issues a short-lived access token + long-lived refresh token for a customer and
// persists the (hashed) refresh token as a Session row for revocation + device tracking.
const issueCustomerTokens = async (userId, deviceInfo) => {
  const accessToken = signAccessToken({ userId, role: 'CUSTOMER' });
  const refreshToken = signRefreshToken({ userId, role: 'CUSTOMER' });
  const decoded = verifyRefreshToken(refreshToken); // exp is in seconds
  await prisma.session.create({
    data: {
      userId,
      token: hashToken(refreshToken),
      expiresAt: new Date(decoded.exp * 1000),
      deviceInfo: deviceInfo || null,
    },
  });
  return { accessToken, refreshToken };
};

// Validates a customer refresh token (signature + role + an un-revoked, unexpired Session row)
// and mints a fresh access token. No rotation — avoids the multi-tab refresh race.
const refreshCustomerSession = async (refreshToken) => {
  if (!refreshToken) {
    const err = new Error('No refresh token'); err.statusCode = 401; throw err;
  }
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    const err = new Error('Invalid or expired refresh token'); err.statusCode = 401; throw err;
  }
  if (decoded.role !== 'CUSTOMER') {
    const err = new Error('Invalid or expired refresh token'); err.statusCode = 401; throw err;
  }
  const session = await prisma.session.findUnique({ where: { token: hashToken(refreshToken) } });
  if (!session || session.expiresAt < new Date()) {
    const err = new Error('Session expired. Please log in again.'); err.statusCode = 401; throw err;
  }
  const accessToken = signAccessToken({ userId: decoded.userId, role: 'CUSTOMER' });
  return { accessToken };
};

// Revokes a customer session (logout) by deleting its stored refresh-token row.
const revokeCustomerSession = async (refreshToken) => {
  if (!refreshToken) return;
  await prisma.session.deleteMany({ where: { token: hashToken(refreshToken) } });
};

const dispatchOtp = async (userId, phone) => {
  const last = await prisma.otp.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  if (last && Date.now() - new Date(last.createdAt).getTime() < OTP_RESEND_COOLDOWN_MS) {
    const retryAfter = Math.ceil(
      (OTP_RESEND_COOLDOWN_MS - (Date.now() - new Date(last.createdAt).getTime())) / 1000,
    );
    const err = new Error(`Please wait ${retryAfter} seconds before requesting another OTP`);
    err.statusCode = 429;
    err.retryAfter = retryAfter;
    throw err;
  }

  await prisma.otp.deleteMany({ where: { userId } });

  const otp = generateOtp();
  await prisma.otp.create({ data: { userId, otp, expiresAt: otpExpiresAt() } });

  try {
    await sendOtpSms(phone, otp);
  } catch (err) {
    console.error('[OTP delivery failed]', err.message);
  }

  if (NODE_ENV !== 'production') console.warn('[DEV] Customer OTP for', phone, ':', otp);
};

const requestOtp = async ({ phone }) => {
  let user = await prisma.user.findFirst({ where: { phone } });

  if (user && !user.isActive) {
    const err = new Error('Account is disabled. Please contact support.');
    err.statusCode = 403;
    throw err;
  }

  if (!user) {
    user = await prisma.user.create({
      data: { phone, role: 'CUSTOMER', isVerified: false },
    });
  }

  await dispatchOtp(user.id, phone);
  return { message: 'OTP sent to your phone.' };
};

const verifyOtp = async ({ phone, otp }, deviceInfo) => {
  const user = await prisma.user.findFirst({ where: { phone } });
  if (!user) {
    const err = new Error('Account not found');
    err.statusCode = 404;
    throw err;
  }

  const record = await prisma.otp.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  });

  if (!record || new Date() > record.expiresAt) {
    const err = new Error('OTP expired. Please request a new one.');
    err.statusCode = 401;
    throw err;
  }

  if (record.attempts >= MAX_OTP_ATTEMPTS) {
    const err = new Error('Too many incorrect attempts. Please request a new OTP.');
    err.statusCode = 429;
    throw err;
  }

  if (record.otp !== otp) {
    await prisma.otp.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    const err = new Error('Invalid OTP');
    err.statusCode = 401;
    throw err;
  }

  await prisma.otp.delete({ where: { id: record.id } });
  await prisma.user.update({ where: { id: user.id }, data: { isVerified: true } });

  // OTP alone authenticates the customer. New users (no name yet) are logged in
  // immediately; their name/email are captured later at checkout. The isNewUser
  // flag lets the client know it still needs to gather those details at buy time.
  const tokens = await issueCustomerTokens(user.id, deviceInfo);
  return {
    ...tokens,
    isNewUser: !user.name,
    user: { id: user.id, name: user.name, email: user.email, phone: user.phone, isVerified: true },
  };
};

const completeRegistration = async ({ phone, name, email, address }, deviceInfo) => {
  const user = await prisma.user.findFirst({ where: { phone } });

  if (!user) {
    const err = new Error('Account not found');
    err.statusCode = 404;
    throw err;
  }

  if (!user.isVerified) {
    const err = new Error('Phone number not verified. Please request a new OTP.');
    err.statusCode = 403;
    throw err;
  }

  if (user.name) {
    const err = new Error('Account already registered.');
    err.statusCode = 409;
    throw err;
  }

  if (email) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.id !== user.id) {
      const err = new Error('An account with this email already exists');
      err.statusCode = 409;
      throw err;
    }
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { name, email: email || null, address: address || null },
  });

  const tokens = await issueCustomerTokens(updated.id, deviceInfo);
  return {
    ...tokens,
    user: {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      phone: updated.phone,
      isVerified: true,
    },
  };
};

const resendOtp = async ({ phone }) => {
  const user = await prisma.user.findFirst({ where: { phone } });
  if (!user) {
    const err = new Error('Account not found');
    err.statusCode = 404;
    throw err;
  }

  await dispatchOtp(user.id, phone);
  return { message: 'OTP resent to your phone.' };
};

module.exports = {
  requestOtp,
  verifyOtp,
  completeRegistration,
  resendOtp,
  refreshCustomerSession,
  revokeCustomerSession,
};
