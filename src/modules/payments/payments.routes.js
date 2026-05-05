const { Router } = require('express');
const ctrl = require('./payments.controller');
const { authenticate } = require('../../middleware/auth');

const router = Router();

// Public — called by mobile/web app
router.post('/create-order', ctrl.createOrder);
router.post('/verify', ctrl.verifyPayment);

// Admin authenticated
router.use(authenticate);
router.get('/', ctrl.getAll);
router.get('/by-entity/:entityType/:entityId', ctrl.getByEntity);
router.get('/:id', ctrl.getById);
router.post('/:id/cod-collect', ctrl.codCollect);
router.post('/:id/refund', ctrl.initiateRefund);

module.exports = router;
