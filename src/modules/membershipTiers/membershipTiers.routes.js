const { Router } = require('express');
const controller = require('./membershipTiers.controller');
const { authenticate } = require('../../middleware/auth');

const router = Router();

// Admin only. No delete: deactivate a tier instead (past memberships keep their snapshot).
router.use(authenticate);
router.get('/', controller.getAll);
router.put('/discounts', controller.updateDiscounts);
router.post('/', controller.create);
router.patch('/:id', controller.update);

module.exports = router;
