const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { getEnv } = require('../../config/env');
const { captureAndConfirm } = require('../payments/payments.service');

const prisma = new PrismaClient();

// ── Handlers ─────────────────────────────────────────────

const handlePaymentCaptured = async (event) => {
  const entity = event.payload.payment.entity;
  const payment = await prisma.payment.findUnique({ where: { razorpayOrderId: entity.order_id } });
  if (!payment) return;
  await captureAndConfirm(payment, {
    razorpayPaymentId: entity.id,
    method: mapRazorpayMethod(entity.method),
    trigger: 'WEBHOOK:payment.captured',
  });
};

// Payment Links create their own Razorpay order under the hood, so the paid
// payment's order_id won't match ours — look the Payment up by the link ID
// (stored at link-creation time) instead of by order_id.
const handlePaymentLinkPaid = async (event) => {
  const linkId = event.payload.payment_link.entity.id;
  const entity = event.payload.payment.entity;
  const payment = await prisma.payment.findUnique({ where: { razorpayPaymentLinkId: linkId } });
  if (!payment) return;
  await captureAndConfirm(payment, {
    razorpayPaymentId: entity.id,
    method: mapRazorpayMethod(entity.method),
    trigger: 'WEBHOOK:payment_link.paid',
  });
};

const handlePaymentFailed = async (event) => {
  const entity = event.payload.payment.entity;
  const payment = await prisma.payment.findUnique({ where: { razorpayOrderId: entity.order_id } });
  if (!payment || payment.status === 'FAILED') return;

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: { status: 'FAILED', failureReason: entity.error_description },
    });

    await tx.paymentLog.create({
      data: {
        paymentId: payment.id,
        fromStatus: payment.status,
        toStatus: 'FAILED',
        trigger: 'WEBHOOK:payment.failed',
        metadata: { error: entity.error_description, code: entity.error_code },
      },
    });

    // A failed payment means the pending slot hold should release immediately
    // instead of waiting on the lazy releaseStaleBookings sweep.
    if (payment.entityType === 'BOOKING') {
      await tx.booking.updateMany({
        where: { id: payment.entityId, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });
    } else if (payment.entityType === 'ORDER') {
      await tx.order.updateMany({
        where: { id: payment.entityId, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });
    } else if (payment.entityType === 'MEMBERSHIP') {
      await tx.membership.updateMany({
        where: { id: payment.entityId, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });
    }
  });
};

const handlePaymentAuthorized = async (event) => {
  const entity = event.payload.payment.entity;
  const payment = await prisma.payment.findUnique({ where: { razorpayOrderId: entity.order_id } });
  if (!payment || payment.status !== 'CREATED') return;

  await prisma.payment.update({ where: { id: payment.id }, data: { status: 'AUTHORIZED' } });
  await prisma.paymentLog.create({
    data: {
      paymentId: payment.id,
      fromStatus: 'CREATED',
      toStatus: 'AUTHORIZED',
      trigger: 'WEBHOOK:payment.authorized',
    },
  });
};

const handleRefundProcessed = async (event) => {
  const entity = event.payload.refund.entity;
  const refund = await prisma.refund.findUnique({ where: { razorpayRefundId: entity.id } });
  if (!refund) return;

  await prisma.refund.update({
    where: { id: refund.id },
    data: { status: 'PROCESSED', processedAt: new Date() },
  });

  // Update payment status
  const payment = await prisma.payment.findUnique({ where: { id: refund.paymentId } });
  if (payment) {
    const totalRefunded = await prisma.refund.aggregate({
      where: { paymentId: payment.id, status: 'PROCESSED' },
      _sum: { amount: true },
    });
    const refundedSum = Number(totalRefunded._sum.amount ?? 0);
    const newStatus = refundedSum >= Number(payment.amount) ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
    await prisma.payment.update({ where: { id: payment.id }, data: { status: newStatus } });
    await prisma.paymentLog.create({
      data: {
        paymentId: payment.id,
        fromStatus: 'CAPTURED',
        toStatus: newStatus,
        trigger: 'WEBHOOK:refund.processed',
        metadata: { refundId: entity.id, amount: entity.amount },
      },
    });
  }
};

// ── Main dispatcher ───────────────────────────────────────

const processWebhook = async (rawBody, signature, eventId) => {
  // Idempotency: try to insert event record
  let webhookEvent;
  try {
    webhookEvent = await prisma.webhookEvent.create({
      data: { eventId, eventType: 'unknown', payload: {}, status: 'RECEIVED' },
    });
  } catch {
    // Duplicate event — already processed
    return { duplicate: true };
  }

  // Verify signature
  const expected = crypto
    .createHmac('sha256', getEnv('RAZORPAY_WEBHOOK_SECRET'))
    .update(rawBody)
    .digest('hex');

  if (expected !== signature) {
    await prisma.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: { status: 'FAILED', error: 'Invalid signature' },
    });
    const err = new Error('Invalid webhook signature');
    err.statusCode = 400;
    throw err;
  }

  const event = JSON.parse(rawBody.toString());
  await prisma.webhookEvent.update({
    where: { id: webhookEvent.id },
    data: { eventType: event.event, payload: event },
  });

  try {
    switch (event.event) {
      case 'payment.captured':    await handlePaymentCaptured(event); break;
      case 'payment_link.paid':   await handlePaymentLinkPaid(event); break;
      case 'payment.failed':      await handlePaymentFailed(event); break;
      case 'payment.authorized':  await handlePaymentAuthorized(event); break;
      case 'refund.processed':    await handleRefundProcessed(event); break;
      default: break;
    }
    await prisma.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: { status: 'PROCESSED', processedAt: new Date() },
    });
  } catch (err) {
    await prisma.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: { status: 'FAILED', error: err.message },
    });
    throw err;
  }

  return { processed: true };
};

const mapRazorpayMethod = (m) => {
  const map = { upi: 'UPI', card: 'CARD', netbanking: 'NETBANKING', wallet: 'WALLET' };
  return map[m] ?? 'OTHER';
};

module.exports = { processWebhook };
