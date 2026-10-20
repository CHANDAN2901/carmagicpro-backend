const { Router } = require('express');
const ctrl = require('./payments.controller');
const { authenticate } = require('../../middleware/auth');
const { customerAuthenticate } = require('../../middleware/customerAuth');

const router = Router();

// Called by mobile/web app. create-order acts on the logged-in customer's own
// booking/order/membership; verify is protected by the Razorpay signature.
router.post('/create-order', customerAuthenticate, ctrl.createOrder);
router.post('/verify', ctrl.verifyPayment);

// Admin authenticated
router.use(authenticate);
router.get('/', ctrl.getAll);
router.get('/by-entity/:entityType/:entityId', ctrl.getByEntity);
router.get('/:id', ctrl.getById);
router.post('/:id/cod-collect', ctrl.codCollect);
router.post('/:id/refund', ctrl.initiateRefund);
router.post('/:id/recheck-link', ctrl.recheckPaymentLink);

module.exports = router;
