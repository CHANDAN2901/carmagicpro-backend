const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const ctrl = require('./auth.controller');
const { authenticate } = require('../../middleware/auth');

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many OTP requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/admin/login', loginLimiter, ctrl.login);
router.post('/admin/verify-otp', otpLimiter, ctrl.verifyOtp);
router.post('/admin/resend-otp', otpLimiter, ctrl.resendOtp);
router.post('/forgot-password', otpLimiter, ctrl.forgotPassword);
router.post('/reset-password', otpLimiter, ctrl.resetPassword);
router.post('/logout', authenticate, ctrl.logout);

module.exports = router;
