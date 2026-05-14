const { Router } = require('express');
const { authenticate } = require('../../middleware/auth');
const { getSettings, updateSettings } = require('./paymentSettings.controller');

const router = Router();

router.get('/', authenticate, getSettings);
router.patch('/', authenticate, updateSettings);

module.exports = router;
