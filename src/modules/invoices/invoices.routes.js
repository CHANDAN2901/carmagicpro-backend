const { Router } = require('express');
const { authenticate } = require('../../middleware/auth');
const ctrl = require('./invoices.controller');

const router = Router();

router.use(authenticate);
router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getById);

module.exports = router;
