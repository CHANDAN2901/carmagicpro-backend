const { Router } = require('express');
const controller = require('./users.controller');
const { authenticate } = require('../../middleware/auth');

const router = Router();

router.use(authenticate);

router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.patch('/:id', controller.update);
router.delete('/bulk', controller.bulkRemove);
router.delete('/:id', controller.remove);

module.exports = router;
