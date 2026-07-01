const { Router } = require('express');
const controller = require('./memberships.controller');
const { authenticate } = require('../../middleware/auth');

const router = Router();

// Public — the static plan catalog for the customer site.
router.get('/plans', controller.getPlans);

// Admin — read-only visibility into purchased memberships.
router.use(authenticate);
router.get('/', controller.getAll);
router.get('/export', controller.exportExcel); // must precede '/:id'
router.get('/:id', controller.getById);

module.exports = router;
