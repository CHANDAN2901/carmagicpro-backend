const { z } = require('zod');
const service = require('./customer.auth.service');
const { NODE_ENV } = require('../../config/env');

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: NODE_ENV === 'production',
  sameSite: NODE_ENV === 'production' ? 'none' : 'strict',
};

const setAuthCookie = (res, token) => {
  res.cookie('access_token', token, { ...COOKIE_OPTIONS, maxAge: 7 * 24 * 60 * 60 * 1000 });
};

const passwordSchema = z
  .string()
  .min(8, 'Min 8 characters')
  .regex(/[A-Z]/, 'Must contain an uppercase letter')
  .regex(/[a-z]/, 'Must contain a lowercase letter')
  .regex(/[0-9]/, 'Must contain a number')
  .regex(/[^A-Za-z0-9]/, 'Must contain a special character');

const identifierSchema = z.string().min(1).refine(
  (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val) || /^[6-9]\d{9}$/.test(val),
  { message: 'Must be a valid email or 10-digit phone number' }
);

const registerSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid phone number').optional(),
  password: passwordSchema,
});

const loginSchema = z.object({
  identifier: identifierSchema,
  password: z.string().min(1),
});

const verifyOtpSchema = z.object({
  identifier: identifierSchema,
  otp: z.string().length(6, 'OTP must be 6 digits'),
});

const resendOtpSchema = z.object({
  identifier: identifierSchema,
});

const register = async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    const result = await service.register(data);
    res.status(201).json({ success: true, ...result });
  } catch (err) { next(err); }
};

const login = async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const result = await service.login(data);
    if (!result.requiresOtp && result.token) {
      setAuthCookie(res, result.token);
    }
    const { token: _t, ...safeResult } = result;
    res.json({ success: true, ...safeResult });
  } catch (err) { next(err); }
};

const verifyOtp = async (req, res, next) => {
  try {
    const data = verifyOtpSchema.parse(req.body);
    const result = await service.verifyOtp(data);
    if (result.token) {
      setAuthCookie(res, result.token);
    }
    const { token: _t, ...safeResult } = result;
    res.json({ success: true, ...safeResult });
  } catch (err) { next(err); }
};

const resendOtp = async (req, res, next) => {
  try {
    const data = resendOtpSchema.parse(req.body);
    const result = await service.resendOtp(data);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
};

const logout = (req, res) => {
  res.clearCookie('access_token', COOKIE_OPTIONS);
  res.json({ success: true, message: 'Logged out' });
};

module.exports = { register, login, verifyOtp, resendOtp, logout };
