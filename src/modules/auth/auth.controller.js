const authService = require('./auth.service');
const { verifyRefreshToken, signAccessToken } = require('../../utils/jwt');
const {
  loginSchema,
  verifyOtpSchema,
  resendOtpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require('./auth.schema');
const { NODE_ENV } = require('../../config/env');

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: NODE_ENV === 'production',
  // 'none' required for cross-origin (Vercel frontend → Render backend); must pair with secure:true
  sameSite: NODE_ENV === 'production' ? 'none' : 'strict',
};

const login = async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const result = await authService.login(body);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

const verifyOtp = async (req, res, next) => {
  try {
    const body = verifyOtpSchema.parse(req.body);
    const { accessToken, refreshToken } = await authService.verifyOtp(body);

    res.cookie('access_token', accessToken, { ...COOKIE_OPTIONS, maxAge: 4 * 60 * 60 * 1000 });
    res.cookie('refresh_token', refreshToken, { ...COOKIE_OPTIONS, maxAge: 7 * 24 * 60 * 60 * 1000 });

    res.json({ success: true, message: 'Logged in' });
  } catch (err) {
    next(err);
  }
};

const resendOtp = async (req, res, next) => {
  try {
    const body = resendOtpSchema.parse(req.body);
    const result = await authService.resendOtp(body);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const body = forgotPasswordSchema.parse(req.body);
    const result = await authService.forgotPassword(body);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const body = resetPasswordSchema.parse(req.body);
    const result = await authService.resetPassword(body);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

const refresh = (req, res) => {
  const token = req.cookies?.refresh_token;
  if (!token) return res.status(401).json({ success: false, message: 'No refresh token' });

  try {
    const decoded = verifyRefreshToken(token);
    const accessToken = signAccessToken({ userId: decoded.userId, role: decoded.role, email: decoded.email });
    res.cookie('access_token', accessToken, { ...COOKIE_OPTIONS, maxAge: 4 * 60 * 60 * 1000 });
    res.json({ success: true, message: 'Token refreshed' });
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
  }
};

const logout = (req, res) => {
  res.clearCookie('access_token', COOKIE_OPTIONS);
  res.clearCookie('refresh_token', COOKIE_OPTIONS);
  res.json({ success: true, message: 'Logged out' });
};

module.exports = { login, verifyOtp, resendOtp, forgotPassword, resetPassword, logout, refresh };
