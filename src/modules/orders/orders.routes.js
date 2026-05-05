const { Router } = require('express');
const controller = require('./orders.controller');
const { authenticate } = require('../../middleware/auth');

const router = Router();

// Public — customer places a product order
router.post('/', controller.createPublic);

router.use(authenticate);

// Admin — manage all orders
router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.patch('/:id', controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
