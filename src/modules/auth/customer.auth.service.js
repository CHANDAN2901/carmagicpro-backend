const bcrypt = require('bcryptjs');
const prisma = require('../../config/prisma');
const { generateOtp, otpExpiresAt } = require('../../utils/otp');
const { signAccessToken } = require('../../utils/jwt');
const { sendCustomerOtpEmail } = require('../../utils/mailer');

const MAX_OTP_ATTEMPTS = 3;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

const isEmail = (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);

const findUserByIdentifier = async (identifier) => {
  if (isEmail(identifier)) {
    return prisma.user.findUnique({ where: { email: identifier } });
  }
  return prisma.user.findFirst({ where: { phone: identifier } });
};

const dispatchOtp = async (userId, email, name) => {
  const last = await prisma.otp.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  if (last && Date.now() - new Date(last.createdAt).getTime() < OTP_RESEND_COOLDOWN_MS) {
    const err = new Error('Please wait 60 seconds before requesting another OTP');
    err.statusCode = 429;
    throw err;
  }

  await prisma.otp.deleteMany({ where: { userId } });

  const otp = generateOtp();
  await prisma.otp.create({ data: { userId, otp, expiresAt: otpExpiresAt() } });

  try {
    await sendCustomerOtpEmail(email, name, otp);
  } catch {
    // intentionally silent
  }
  console.warn('[DEV] Customer OTP for', email, ':', otp);
};

const register = async ({ name, email, phone, password }) => {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    const err = new Error('An account with this email already exists');
    err.statusCode = 409;
    throw err;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { name, email, phone, passwordHash, role: 'CUSTOMER', isVerified: false },
  });

  await dispatchOtp(user.id, user.email, user.name);
  return { message: 'Account created. Please check your email for the verification OTP.' };
};

const login = async ({ identifier, password }) => {
  const GENERIC = { status: 401, message: 'Invalid credentials' };

  const user = await findUserByIdentifier(identifier);
  if (!user || user.role !== 'CUSTOMER') throw GENERIC;

  if (!user.isActive) {
    const err = new Error('Account is disabled. Please contact support.');
    err.statusCode = 403;
    throw err;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw GENERIC;

  if (user.twoFactorEnabled) {
    await dispatchOtp(user.id, user.email, user.name);
    return { requiresOtp: true, message: 'OTP sent to your email. Please verify to continue.' };
  }

  const token = signAccessToken({ userId: user.id, email: user.email, role: 'CUSTOMER' });
  return {
    requiresOtp: false,
    token,
    user: { id: user.id, name: user.name, email: user.email, phone: user.phone, isVerified: user.isVerified, twoFactorEnabled: user.twoFactorEnabled },
  };
};

const verifyOtp = async ({ identifier, otp }) => {
  const user = await findUserByIdentifier(identifier);
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

  if (!user.isVerified) {
    await prisma.user.update({ where: { id: user.id }, data: { isVerified: true } });
  }

  const token = signAccessToken({ userId: user.id, email: user.email, role: 'CUSTOMER' });
  return {
    token,
    user: { id: user.id, name: user.name, email: user.email, phone: user.phone, isVerified: true, twoFactorEnabled: user.twoFactorEnabled },
  };
};

const resendOtp = async ({ identifier }) => {
  const user = await findUserByIdentifier(identifier);
  if (!user) {
    const err = new Error('Account not found');
    err.statusCode = 404;
    throw err;
  }

  await dispatchOtp(user.id, user.email, user.name);
  return { message: 'OTP resent to your email.' };
};

const forgotPassword = async ({ email }) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.role !== 'CUSTOMER') throw { status: 404, message: 'No account found with this email' };

  await prisma.otp.deleteMany({ where: { userId: user.id } });
  const otp = generateOtp();
  await prisma.otp.create({ data: { userId: user.id, otp, expiresAt: otpExpiresAt() } });

  try {
    await sendCustomerOtpEmail(user.email, user.name, otp);
  } catch {
    // intentionally silent
  }
  console.warn('[DEV] Customer forgot-password OTP for', user.email, ':', otp);

  return { message: 'OTP sent to your email' };
};

const resetPassword = async ({ email, otp, password }) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.role !== 'CUSTOMER') throw { status: 401, message: 'Invalid request' };

  const record = await prisma.otp.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  });

  if (!record || new Date() > record.expiresAt) throw { status: 401, message: 'OTP expired' };
  if (record.attempts >= MAX_OTP_ATTEMPTS) throw { status: 429, message: 'Too many attempts' };
  if (record.otp !== otp) {
    await prisma.otp.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    throw { status: 401, message: 'Invalid OTP' };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  await prisma.otp.delete({ where: { id: record.id } });

  return { message: 'Password reset successful' };
};

module.exports = { register, login, verifyOtp, resendOtp, forgotPassword, resetPassword };
