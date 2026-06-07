const { Router } = require('express');
const controller = require('./orders.controller');
const { authenticate } = require('../../middleware/auth');

const router = Router();

// NOTE: customers place product orders via POST /customer/orders
// (customer.controller.createOrder), which prices and decrements stock by
// variation. The previous public POST /orders route priced off the product
// base price (now removed) and has been retired to keep a single, correct
// order entry point.

router.use(authenticate);

// Admin — manage all orders
router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.patch('/:id', controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
