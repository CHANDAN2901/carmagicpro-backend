const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const ctrl = require('./auth.controller');
const customerCtrl = require('./customer.auth.controller');
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

// Customer auth
router.post('/customer/register', loginLimiter, customerCtrl.register);
router.post('/customer/login', loginLimiter, customerCtrl.login);
router.post('/customer/verify-otp', otpLimiter, customerCtrl.verifyOtp);
router.post('/customer/resend-otp', otpLimiter, customerCtrl.resendOtp);
router.post('/customer/logout', customerCtrl.logout);

module.exports = router;
