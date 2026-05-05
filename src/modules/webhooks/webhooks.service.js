const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { getEnv } = require('../../config/env');

const prisma = new PrismaClient();

// Re-use invoice creation logic
const generateInvoiceNumber = async () => {
  const result = await prisma.$queryRaw`
    UPDATE invoice_counter SET last_seq = last_seq + 1 WHERE id = 1 RETURNING last_seq
  `;
  const seq = Number(result[0].last_seq);
  return `INV-${new Date().getFullYear()}-${String(seq).padStart(6, '0')}`;
};

const buildLineItemsSnapshot = async (entityType, entityId) => {
  if (entityType === 'BOOKING') {
    const booking = await prisma.booking.findUnique({
      where: { id: entityId },
      include: { service: { select: { name: true, durationMins: true } } },
    });
    if (!booking) return [];
    return [{
      name: booking.service?.name ?? 'Service',
      durationMins: booking.service?.durationMins,
      scheduledAt: booking.scheduledAt,
      unitPrice: Number(booking.totalAmount),
      quantity: 1,
      total: Number(booking.totalAmount),
    }];
  }
  const order = await prisma.order.findUnique({
    where: { id: entityId },
    include: { items: { include: { product: { select: { name: true, sku: true } } } } },
  });
  if (!order) return [];
  return order.items.map((item) => ({
    name: item.product?.name ?? 'Product',
    sku: item.product?.sku,
    quantity: item.quantity,
    unitPrice: Number(item.unitPrice),
    total: item.quantity * Number(item.unitPrice),
  }));
};

// ── Handlers ─────────────────────────────────────────────

const handlePaymentCaptured = async (event) => {
  const entity = event.payload.payment.entity;
  const razorpayOrderId = entity.order_id;

  const payment = await prisma.payment.findUnique({ where: { razorpayOrderId } });
  if (!payment || payment.status === 'CAPTURED') return; // already processed

  const razorpayPaymentId = entity.id;
  const method = mapRazorpayMethod(entity.method);

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'CAPTURED',
        razorpayPaymentId,
        method,
        capturedAt: new Date(),
      },
    });

    await tx.paymentLog.create({
      data: {
        paymentId: payment.id,
        fromStatus: payment.status,
        toStatus: 'CAPTURED',
        trigger: 'WEBHOOK:payment.captured',
        metadata: { razorpayPaymentId, method, amount: entity.amount },
      },
    });

    if (payment.couponId) {
      const user = await tx.user.findUnique({ where: { id: payment.userId }, select: { phone: true } });
      if (user) {
        await tx.couponUsage.upsert({
          where: { couponId_userPhone: { couponId: payment.couponId, userPhone: user.phone } },
          update: {},
          create: { couponId: payment.couponId, userPhone: user.phone },
        });
        await tx.coupon.update({ where: { id: payment.couponId }, data: { usedCount: { increment: 1 } } });
      }
    }

    // Generate invoice
    const invoiceNumber = await generateInvoiceNumber();
    const snapshot = await buildLineItemsSnapshot(payment.entityType, payment.entityId);
    await tx.invoice.create({
      data: {
        paymentId: payment.id,
        invoiceNumber,
        entityType: payment.entityType,
        entityId: payment.entityId,
        userId: payment.userId,
        lineItemsSnapshot: snapshot,
        subtotal: Number(payment.grossAmount),
        discountAmount: Number(payment.discountAmount ?? 0),
        taxAmount: 0,
        totalAmount: Number(payment.amount),
        couponCode: payment.couponCode,
      },
    });

    // Confirm entity
    if (payment.entityType === 'BOOKING') {
      await tx.booking.update({ where: { id: payment.entityId }, data: { status: 'CONFIRMED' } });
    } else {
      await tx.order.update({ where: { id: payment.entityId }, data: { status: 'CONFIRMED' } });
    }
  });
};

const handlePaymentFailed = async (event) => {
  const entity = event.payload.payment.entity;
  const payment = await prisma.payment.findUnique({ where: { razorpayOrderId: entity.order_id } });
  if (!payment || payment.status === 'FAILED') return;

  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: 'FAILED', failureReason: entity.error_description },
  });

  await prisma.paymentLog.create({
    data: {
      paymentId: payment.id,
      fromStatus: payment.status,
      toStatus: 'FAILED',
      trigger: 'WEBHOOK:payment.failed',
      metadata: { error: entity.error_description, code: entity.error_code },
    },
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
