const { Router } = require('express');
const controller = require('./coupons.controller');
const { authenticate } = require('../../middleware/auth');

const router = Router();

router.post('/apply', controller.apply);

router.use(authenticate);

router.get('/wash/:code', controller.lookupWash);
router.post('/wash/:code/redeem', controller.redeemWash);
router.post('/wash/:code/undo', controller.undoWash);
router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.patch('/:id', controller.update);
router.delete('/bulk', controller.bulkRemove);
router.delete('/:id', controller.remove);

module.exports = router;
