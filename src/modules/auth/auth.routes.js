const { Router } = require('express');
const ctrl = require('./auth.controller');
const customerCtrl = require('./customer.auth.controller');
const { authenticate } = require('../../middleware/auth');

const router = Router();

router.post('/admin/refresh', ctrl.refresh);
router.post('/admin/login', ctrl.login);
router.post('/admin/verify-otp', ctrl.verifyOtp);
router.post('/admin/resend-otp', ctrl.resendOtp);
router.post('/forgot-password', ctrl.forgotPassword);
router.post('/reset-password', ctrl.resetPassword);
router.post('/logout', authenticate, ctrl.logout);

// Customer auth
router.post('/customer/request-otp', customerCtrl.requestOtp);
router.post('/customer/verify-otp', customerCtrl.verifyOtp);
router.post('/customer/complete-registration', customerCtrl.completeRegistration);
router.post('/customer/resend-otp', customerCtrl.resendOtp);
router.post('/customer/logout', customerCtrl.logout);

module.exports = router;
