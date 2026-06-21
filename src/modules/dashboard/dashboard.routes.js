const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');
const { getStats, getTrends } = require('./dashboard.controller');

router.get('/stats', authenticate, getStats);
router.get('/trends', authenticate, getTrends);

module.exports = router;
