const { Router } = require('express');
const controller = require('./coupons.controller');
const { authenticate } = require('../../middleware/auth');

const router = Router();

router.post('/apply', controller.apply);

router.use(authenticate);

router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.patch('/:id', controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
