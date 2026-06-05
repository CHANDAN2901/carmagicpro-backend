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

const phoneSchema = z.object({
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
});

const verifyOtpSchema = z.object({
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
  otp: z.string().length(6, 'OTP must be 6 digits'),
});

const completeRegistrationSchema = z.object({
  phone: z.string().regex(/^[6-9]\d{9}$/),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  address: z.string().max(300).optional().or(z.literal('')),
});

const requestOtp = async (req, res, next) => {
  try {
    const data = phoneSchema.parse(req.body);
    const result = await service.requestOtp(data);
    res.json({ success: true, ...result });
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

const completeRegistration = async (req, res, next) => {
  try {
    const raw = completeRegistrationSchema.parse(req.body);
    const data = {
      ...raw,
      email: raw.email || undefined,
      address: raw.address || undefined,
    };
    const result = await service.completeRegistration(data);
    if (result.token) {
      setAuthCookie(res, result.token);
    }
    const { token: _t, ...safeResult } = result;
    res.status(201).json({ success: true, ...safeResult });
  } catch (err) { next(err); }
};

const resendOtp = async (req, res, next) => {
  try {
    const data = phoneSchema.parse(req.body);
    const result = await service.resendOtp(data);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
};

const logout = (req, res) => {
  res.clearCookie('access_token', COOKIE_OPTIONS);
  res.json({ success: true, message: 'Logged out' });
};

module.exports = { requestOtp, verifyOtp, completeRegistration, resendOtp, logout };
