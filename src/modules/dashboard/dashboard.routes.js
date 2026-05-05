const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');
const { getStats } = require('./dashboard.controller');

router.get('/stats', authenticate, getStats);

module.exports = router;
