const { Router } = require('express');
const controller = require('./slots.controller');
const { authenticate } = require('../../middleware/auth');

const router = Router();

router.get('/available', controller.getAvailable);

router.use(authenticate);

router.get('/config', controller.getConfig);
router.put('/config', controller.saveConfig);
router.get('/blocked-dates', controller.getBlockedDates);
router.post('/blocked-dates', controller.addBlockedDate);
router.delete('/blocked-dates/:id', controller.removeBlockedDate);

module.exports = router;
