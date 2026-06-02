const bcrypt = require('bcryptjs');
const prisma = require('../../config/prisma');
const { generateOtp, otpExpiresAt } = require('../../utils/otp');
const { sendOtpEmail } = require('../../utils/mailer');
const { signAccessToken, signRefreshToken } = require('../../utils/jwt');
const { NODE_ENV } = require('../../config/env');

const GENERIC_ERROR = { status: 401, message: 'Invalid credentials' };
const MAX_OTP_ATTEMPTS = 3;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

const login = async ({ email, password }) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.role !== 'ADMIN') throw { status: 401, message: GENERIC_ERROR.message };

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw { status: 401, message: GENERIC_ERROR.message };

  await prisma.otp.deleteMany({ where: { userId: user.id } });

  const otp = generateOtp();
  const expiresAt = otpExpiresAt();
  await prisma.otp.create({ data: { userId: user.id, otp, expiresAt } });

  try {
    await sendOtpEmail(user.email, otp);
  } catch {
    // intentionally empty
  }
  if (NODE_ENV !== 'production') console.warn('[DEV] OTP for', user.email, ':', otp);

  return { message: 'OTP sent' };
};

const verifyOtp = async ({ email, otp }) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.role !== 'ADMIN') throw { status: 401, message: GENERIC_ERROR.message };

  const record = await prisma.otp.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  });

  if (!record || new Date() > record.expiresAt) throw { status: 401, message: GENERIC_ERROR.message };
  if (record.attempts >= MAX_OTP_ATTEMPTS) throw { status: 429, message: 'Too many incorrect attempts. Please request a new OTP.' };

  if (record.otp !== otp) {
    await prisma.otp.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    throw { status: 401, message: 'Invalid OTP' };
  }

  await prisma.otp.delete({ where: { id: record.id } });

  const payload = { userId: user.id, email: user.email, role: 'ADMIN' };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  return { accessToken, refreshToken };
};

const resendOtp = async ({ email }) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.role !== 'ADMIN') throw { status: 401, message: GENERIC_ERROR.message };

  const last = await prisma.otp.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  });

  if (last && Date.now() - new Date(last.createdAt).getTime() < OTP_RESEND_COOLDOWN_MS) {
    const retryAfter = Math.ceil((OTP_RESEND_COOLDOWN_MS - (Date.now() - new Date(last.createdAt).getTime())) / 1000);
    throw { status: 429, message: `Please wait ${retryAfter} seconds before requesting another OTP`, retryAfter };
  }

  await prisma.otp.deleteMany({ where: { userId: user.id } });

  const otp = generateOtp();
  await prisma.otp.create({ data: { userId: user.id, otp, expiresAt: otpExpiresAt() } });

  try {
    await sendOtpEmail(user.email, otp);
  } catch {
    // intentionally empty
  }
  if (NODE_ENV !== 'production') console.warn('[DEV] OTP for', user.email, ':', otp);

  return { message: 'OTP resent' };
};

const forgotPassword = async ({ email }) => {
  const GENERIC_RESPONSE = { message: 'If an account exists for this email, an OTP has been sent.' };

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.role !== 'ADMIN') return GENERIC_RESPONSE;

  await prisma.otp.deleteMany({ where: { userId: user.id } });
  const otp = generateOtp();
  await prisma.otp.create({ data: { userId: user.id, otp, expiresAt: otpExpiresAt() } });

  try {
    await sendOtpEmail(user.email, otp);
  } catch {
    // intentionally empty
  }
  if (NODE_ENV !== 'production') console.warn('[DEV] Admin forgot-password OTP for', user.email, ':', otp);

  return GENERIC_RESPONSE;
};

const resetPassword = async ({ email, otp, password }) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.role !== 'ADMIN') throw { status: 401, message: 'Invalid request' };

  const record = await prisma.otp.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  });

  if (!record || new Date() > record.expiresAt) throw { status: 401, message: 'OTP expired' };
  if (record.attempts >= MAX_OTP_ATTEMPTS) throw { status: 429, message: 'Too many incorrect attempts. Please request a new OTP.' };
  if (record.otp !== otp) {
    await prisma.otp.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    throw { status: 401, message: 'Invalid OTP' };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  await prisma.otp.delete({ where: { id: record.id } });

  return { message: 'Password reset successful' };
};

module.exports = { login, verifyOtp, resendOtp, forgotPassword, resetPassword };
