const { Router } = require('express');
const { razorpayWebhook } = require('./webhooks.controller');

const router = Router();

// Raw body is captured in server.js before express.json() for this path
router.post('/razorpay', razorpayWebhook);

module.exports = router;
