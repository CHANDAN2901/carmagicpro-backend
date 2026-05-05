const bcrypt = require('bcryptjs');
const prisma = require('../../config/prisma');
const { generateOtp, otpExpiresAt } = require('../../utils/otp');
const { sendOtpEmail } = require('../../utils/mailer');
const { signAccessToken, signRefreshToken } = require('../../utils/jwt');

const GENERIC_ERROR = { status: 401, message: 'Invalid credentials' };
const MAX_OTP_ATTEMPTS = 3;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

const login = async ({ email, password }) => {
  const admin = await prisma.admin.findUnique({ where: { email } });
  if (!admin) throw { status: 401, message: GENERIC_ERROR.message };

  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) throw { status: 401, message: GENERIC_ERROR.message };

  // Delete any existing OTPs and send a fresh one
  await prisma.otp.deleteMany({ where: { adminId: admin.id } });

  const otp = generateOtp();
  const expiresAt = otpExpiresAt();
  await prisma.otp.create({ data: { adminId: admin.id, otp, expiresAt } });

  try {
    await sendOtpEmail(admin.email, otp);
  } catch {
    // intentionally empty
  }
  console.warn('[DEV] OTP for', admin.email, ':', otp);

  return { message: 'OTP sent' };
};

const verifyOtp = async ({ email, otp }) => {
  const admin = await prisma.admin.findUnique({ where: { email } });
  if (!admin) throw { status: 401, message: GENERIC_ERROR.message };

  const record = await prisma.otp.findFirst({
    where: { adminId: admin.id },
    orderBy: { createdAt: 'desc' },
  });

  if (!record || new Date() > record.expiresAt) throw { status: 401, message: GENERIC_ERROR.message };
  if (record.attempts >= MAX_OTP_ATTEMPTS) throw { status: 429, message: 'Too many attempts' };

  if (record.otp !== otp) {
    await prisma.otp.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    throw { status: 401, message: 'Invalid OTP' };
  }

  await prisma.otp.delete({ where: { id: record.id } });

  const payload = { adminId: admin.id, email: admin.email };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  return { accessToken, refreshToken };
};

const resendOtp = async ({ email }) => {
  const admin = await prisma.admin.findUnique({ where: { email } });
  if (!admin) throw { status: 401, message: GENERIC_ERROR.message };

  const last = await prisma.otp.findFirst({
    where: { adminId: admin.id },
    orderBy: { createdAt: 'desc' },
  });

  if (last && Date.now() - new Date(last.createdAt).getTime() < OTP_RESEND_COOLDOWN_MS) {
    throw { status: 429, message: 'Please wait before requesting another OTP' };
  }

  await prisma.otp.deleteMany({ where: { adminId: admin.id } });

  const otp = generateOtp();
  await prisma.otp.create({ data: { adminId: admin.id, otp, expiresAt: otpExpiresAt() } });

  try {
    await sendOtpEmail(admin.email, otp);
  } catch {
    // intentionally empty
  }
  console.warn('[DEV] OTP for', admin.email, ':', otp);

  return { message: 'OTP resent' };
};

const forgotPassword = async ({ email }) => {
  const admin = await prisma.admin.findUnique({ where: { email } });
  // Always return success to avoid email enumeration
  if (!admin) return { message: 'If the email exists, an OTP has been sent' };

  await prisma.otp.deleteMany({ where: { adminId: admin.id } });
  const otp = generateOtp();
  await prisma.otp.create({ data: { adminId: admin.id, otp, expiresAt: otpExpiresAt() } });
  await sendOtpEmail(admin.email, otp);

  return { message: 'If the email exists, an OTP has been sent' };
};

const resetPassword = async ({ email, otp, password }) => {
  const admin = await prisma.admin.findUnique({ where: { email } });
  if (!admin) throw { status: 401, message: 'Invalid request' };

  const record = await prisma.otp.findFirst({
    where: { adminId: admin.id },
    orderBy: { createdAt: 'desc' },
  });

  if (!record || new Date() > record.expiresAt) throw { status: 401, message: 'OTP expired' };
  if (record.attempts >= MAX_OTP_ATTEMPTS) throw { status: 429, message: 'Too many attempts' };
  if (record.otp !== otp) {
    await prisma.otp.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    throw { status: 401, message: 'Invalid OTP' };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.admin.update({ where: { id: admin.id }, data: { passwordHash } });
  await prisma.otp.delete({ where: { id: record.id } });

  return { message: 'Password reset successful' };
};

module.exports = { login, verifyOtp, resendOtp, forgotPassword, resetPassword };
