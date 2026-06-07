const { z } = require('zod');
const service = require('./customer.auth.service');
const { getToken } = require('../../utils/getToken');
const { NODE_ENV } = require('../../config/env');

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: NODE_ENV === 'production',
  sameSite: NODE_ENV === 'production' ? 'none' : 'strict',
};

const ACCESS_COOKIE_MAX_AGE = 15 * 60 * 1000; // 15m — matches JWT_EXPIRES_IN default
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7d

// Web clients authenticate via these httpOnly cookies. Mobile clients ignore them and
// read the tokens from the JSON body instead (stored in device secure storage).
const setAuthCookies = (res, { accessToken, refreshToken }) => {
  res.cookie('customer_access_token', accessToken, { ...COOKIE_OPTIONS, maxAge: ACCESS_COOKIE_MAX_AGE });
  if (refreshToken) {
    res.cookie('customer_refresh_token', refreshToken, { ...COOKIE_OPTIONS, maxAge: REFRESH_COOKIE_MAX_AGE });
  }
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
    const result = await service.verifyOtp(data, req.get('user-agent'));
    // result has tokens for an existing user, or { isNewUser: true } for a fresh signup.
    if (result.accessToken) setAuthCookies(res, result);
    res.json({ success: true, ...result });
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
    const result = await service.completeRegistration(data, req.get('user-agent'));
    if (result.accessToken) setAuthCookies(res, result);
    res.status(201).json({ success: true, ...result });
  } catch (err) { next(err); }
};

const resendOtp = async (req, res, next) => {
  try {
    const data = phoneSchema.parse(req.body);
    const result = await service.resendOtp(data);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
};

const refresh = async (req, res, next) => {
  try {
    // Web sends the customer_refresh_token cookie; mobile sends it as a Bearer header or body field.
    const refreshToken = getToken(req, 'customer_refresh_token') || req.body?.refreshToken;
    const { accessToken } = await service.refreshCustomerSession(refreshToken);
    res.cookie('customer_access_token', accessToken, { ...COOKIE_OPTIONS, maxAge: ACCESS_COOKIE_MAX_AGE });
    res.json({ success: true, accessToken });
  } catch (err) { next(err); }
};

const logout = async (req, res, next) => {
  try {
    const refreshToken = getToken(req, 'customer_refresh_token') || req.body?.refreshToken;
    await service.revokeCustomerSession(refreshToken);
    res.clearCookie('customer_access_token', COOKIE_OPTIONS);
    res.clearCookie('customer_refresh_token', COOKIE_OPTIONS);
    res.json({ success: true, message: 'Logged out' });
  } catch (err) { next(err); }
};

module.exports = { requestOtp, verifyOtp, completeRegistration, resendOtp, refresh, logout };
