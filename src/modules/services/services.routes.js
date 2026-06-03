const { Router } = require('express');
const controller = require('./services.controller');
const { authenticate } = require('../../middleware/auth');

const router = Router();

router.get('/', controller.getAll);
router.get('/:id', controller.getById);

router.use(authenticate);

router.post('/', controller.create);
router.patch('/:id', controller.update);
router.delete('/bulk', controller.bulkRemove);
router.delete('/:id', controller.remove);

module.exports = router;
