const bcrypt = require('bcryptjs');
const prisma = require('../../config/prisma');
const { generateOtp, otpExpiresAt } = require('../../utils/otp');
const { signAccessToken } = require('../../utils/jwt');
const { sendCustomerOtpEmail } = require('../../utils/mailer');

const MAX_OTP_ATTEMPTS = 3;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

// ── Shared: send OTP to email (replaces any existing OTP for that email) ──
const dispatchOtp = async (email, name) => {
  const last = await prisma.customerOtp.findFirst({
    where: { email },
    orderBy: { createdAt: 'desc' },
  });

  if (last && Date.now() - new Date(last.createdAt).getTime() < OTP_RESEND_COOLDOWN_MS) {
    const err = new Error('Please wait 60 seconds before requesting another OTP');
    err.statusCode = 429;
    throw err;
  }

  await prisma.customerOtp.deleteMany({ where: { email } });

  const otp = generateOtp();
  await prisma.customerOtp.create({ data: { email, otp, expiresAt: otpExpiresAt() } });

  try {
    await sendCustomerOtpEmail(email, name, otp);
  } catch {
    // intentionally silent
  }
  console.warn('[DEV] Customer OTP for', email, ':', otp);
};

// ── Register: create unverified account + send OTP ───────
const register = async ({ name, email, password }) => {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    const err = new Error('An account with this email already exists');
    err.statusCode = 409;
    throw err;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: { name, email, passwordHash, isVerified: false },
  });

  await dispatchOtp(email, name);
  return { message: 'Account created. Please check your email for the verification OTP.' };
};

// ── Login: verify password + send OTP ────────────────────
const login = async ({ email, password }) => {
  const GENERIC = { status: 401, message: 'Invalid email or password' };

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw GENERIC;

  if (!user.isActive) {
    const err = new Error('Account is disabled. Please contact support.');
    err.statusCode = 403;
    throw err;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw GENERIC;

  await dispatchOtp(email, user.name);
  return { message: 'OTP sent to your email. Please verify to continue.' };
};

// ── Verify OTP: shared for both register and login ────────
const verifyOtp = async ({ email, otp }) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const err = new Error('Account not found');
    err.statusCode = 404;
    throw err;
  }

  const record = await prisma.customerOtp.findFirst({
    where: { email },
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
    await prisma.customerOtp.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    const err = new Error('Invalid OTP');
    err.statusCode = 401;
    throw err;
  }

  await prisma.customerOtp.delete({ where: { id: record.id } });

  // Activate account on first verify (register flow)
  if (!user.isVerified) {
    await prisma.user.update({ where: { email }, data: { isVerified: true } });
  }

  const token = signAccessToken({ userId: user.id, email: user.email });
  return {
    token,
    user: { id: user.id, name: user.name, email: user.email, isVerified: true },
  };
};

// ── Resend OTP ────────────────────────────────────────────
const resendOtp = async ({ email }) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const err = new Error('Account not found');
    err.statusCode = 404;
    throw err;
  }

  await dispatchOtp(email, user.name);
  return { message: 'OTP resent to your email.' };
};

module.exports = { register, login, verifyOtp, resendOtp };
