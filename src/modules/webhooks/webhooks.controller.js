const { processWebhook } = require('./webhooks.service');

const razorpayWebhook = async (req, res, next) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const eventId = req.headers['x-razorpay-event-id'] ?? `fallback-${Date.now()}`;

    if (!signature) return res.status(400).json({ success: false, message: 'Missing signature' });

    const result = await processWebhook(req.body, signature, eventId);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

module.exports = { razorpayWebhook };
