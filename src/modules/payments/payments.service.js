const crypto = require('crypto');
const Razorpay = require('razorpay');
const { PrismaClient } = require('@prisma/client');
const {
  sendMembershipConfirmationEmail,
  sendMembershipNotificationToAdmin,
  sendBookingConfirmationEmail,
  sendBookingNotificationToAdmin,
} = require('../../utils/mailer');

const prisma = new PrismaClient();

const fmtDate = (d) => {
  try {
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return String(d ?? ''); }
};

// Fire-and-forget: notify customer + admin that a membership is now active.
// Called after activateMembership so startDate/expiresAt are set. paymentMethod
// / paymentStatus reflect how the membership was paid for (COD vs online).
const sendMembershipEmails = async (membershipId, { paymentMethod, paymentStatus, amount }) => {
  const membership = await prisma.membership.findUnique({
    where: { id: membershipId },
    include: { user: { select: { name: true, email: true, phone: true } } },
  });
  if (!membership) return;

  const validity = membership.startDate && membership.expiresAt
    ? `${fmtDate(membership.startDate)} – ${fmtDate(membership.expiresAt)}`
    : null;

  const payload = {
    membershipNumber: membership.membershipNumber,
    customerName: membership.user?.name ?? 'Customer',
    customerEmail: membership.user?.email ?? null,
    customerMobile: membership.user?.phone ?? null,
    planName: membership.planName,
    washesPerYear: membership.washesPerYear,
    validity,
    paymentMethod,
    paymentStatus,
    amount: Number(amount ?? membership.price).toFixed(2),
  };

  const tasks = [sendMembershipNotificationToAdmin(payload)];
  if (membership.user?.email) tasks.push(sendMembershipConfirmationEmail(membership.user.email, payload));
  await Promise.allSettled(tasks);
};

const pad2 = (n) => String(n).padStart(2, '0');

// The booking's address / home-pickup flag / customer note are flattened into the
// `notes` column at creation (see customer.controller.createBooking). Un-flatten
// them here so the confirmation email shows a clean address + the customer's note.
const parseBookingNotes = (notes) => {
  const segments = (notes ?? '').split(' | ').map((s) => s.trim()).filter(Boolean);
  let address = null;
  let homePickup = false;
  const rest = [];
  for (const seg of segments) {
    if (seg === 'Home pickup') homePickup = true;
    else if (seg.startsWith('Address: ')) address = seg.slice('Address: '.length);
    else if (seg.startsWith('Payment: ')) { /* internal marker — drop */ }
    else rest.push(seg);
  }
  const serviceAddress = address || (homePickup ? 'Home pickup' : 'Workshop / Walk-in');
  return { serviceAddress, customerNotes: rest.join(' | ') || null };
};

// Fire-and-forget: notify customer + admin that a booking is confirmed. Called on
// successful payment (COD placed / Razorpay verified), not at booking creation.
const sendBookingEmails = async (bookingId, { paymentMethod, paymentStatus, amount }) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      service: { select: { name: true } },
      carModel: { select: { name: true, brand: { select: { name: true } } } },
      user: { select: { name: true, email: true, phone: true } },
    },
  });
  if (!booking) return;

  const { serviceAddress, customerNotes } = parseBookingNotes(booking.notes);
  const vehicleModel = booking.carModel
    ? [booking.carModel.brand?.name, booking.carModel.name].filter(Boolean).join(' ')
    : null;
  const scheduled = booking.scheduledAt;

  const payload = {
    bookingNumber: booking.bookingNumber,
    customerName: booking.user?.name ?? 'Customer',
    customerEmail: booking.user?.email ?? null,
    customerMobile: booking.user?.phone ?? null,
    serviceName: booking.service?.name ?? '—',
    vehicleNumber: booking.plateNumber ?? '—',
    vehicleModel,
    bookingDate: fmtDate(scheduled),
    bookingTime: `${pad2(scheduled.getHours())}:${pad2(scheduled.getMinutes())}`,
    serviceAddress,
    paymentMethod,
    paymentStatus,
    amount: Number(amount ?? booking.totalAmount).toFixed(2),
    notes: customerNotes,
  };

  const tasks = [sendBookingNotificationToAdmin(payload)];
  if (booking.user?.email) tasks.push(sendBookingConfirmationEmail(booking.user.email, payload));
  await Promise.allSettled(tasks);
};

// Idempotent, race-safe confirmation dispatch. Uses an atomic compare-and-set on
// payments.confirmationSentAt: only the first caller flips it from null and sends,
// so no matter how many times /verify fires — or which path (fresh capture vs the
// already-captured early-return) reaches here — the customer + admin emails go out
// exactly once. This is the single entry point for BOOKING/MEMBERSHIP confirmation
// mail; ORDER mail is sent at order creation, not here.
const sendConfirmationEmailsOnce = async (paymentId, { paymentMethod, paymentStatus }) => {
  const claim = await prisma.payment.updateMany({
    where: { id: paymentId, confirmationSentAt: null },
    data: { confirmationSentAt: new Date() },
  });
  if (claim.count === 0) return; // another call already dispatched
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) return;
  const info = { paymentMethod, paymentStatus, amount: payment.amount };
  if (payment.entityType === 'BOOKING') await sendBookingEmails(payment.entityId, info);
  else if (payment.entityType === 'MEMBERSHIP') await sendMembershipEmails(payment.entityId, info);
};

const getRazorpayMode = async () => {
  const setting = await prisma.appSetting.findUnique({ where: { key: 'razorpay_mode' } });
  return setting?.value ?? 'test';
};

const getRazorpay = async () => {
  const mode = await getRazorpayMode();
  const suffix = mode.toUpperCase();
  return new Razorpay({
    key_id: process.env[`RAZORPAY_KEY_ID_${suffix}`],
    key_secret: process.env[`RAZORPAY_KEY_SECRET_${suffix}`],
  });
};

// ── Membership helper ────────────────────────────────────

// Activates a membership on successful payment: 1-year term from today.
const activateMembership = (client, membershipId) => {
  const startDate = new Date();
  const expiresAt = new Date(startDate);
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  return client.membership.update({
    where: { id: membershipId },
    data: { status: 'ACTIVE', startDate, expiresAt },
  });
};

// ── Invoice helpers ──────────────────────────────────────

const generateInvoiceNumber = async () => {
  const result = await prisma.$queryRaw`
    UPDATE invoice_counter SET last_seq = last_seq + 1 WHERE id = 1 RETURNING last_seq
  `;
  const seq = Number(result[0].last_seq);
  const year = new Date().getFullYear();
  return `INV-${year}-${String(seq).padStart(6, '0')}`;
};

const buildLineItemsSnapshot = async (entityType, entityId) => {
  if (entityType === 'MEMBERSHIP') {
    const membership = await prisma.membership.findUnique({ where: { id: entityId } });
    if (!membership) return [];
    return [
      {
        name: membership.planName,
        washesPerYear: membership.washesPerYear,
        unitPrice: Number(membership.price),
        quantity: 1,
        total: Number(membership.price),
      },
    ];
  }
  if (entityType === 'BOOKING') {
    const booking = await prisma.booking.findUnique({
      where: { id: entityId },
      include: { service: { select: { name: true, durationMins: true } } },
    });
    if (!booking) return [];
    return [
      {
        name: booking.service?.name ?? 'Service',
        durationMins: booking.service?.durationMins,
        scheduledAt: booking.scheduledAt,
        unitPrice: Number(booking.totalAmount),
        quantity: 1,
        total: Number(booking.totalAmount),
      },
    ];
  }
  // ORDER
  const order = await prisma.order.findUnique({
    where: { id: entityId },
    include: {
      items: {
        include: {
          product: { select: { name: true, sku: true } },
          variation: { select: { name: true, sku: true } },
        },
      },
    },
  });
  if (!order) return [];
  return order.items.map((item) => {
    const productName = item.product?.name ?? 'Product';
    return {
      name: item.variation ? `${productName} — ${item.variation.name}` : productName,
      sku: item.variation?.sku ?? item.product?.sku,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      total: item.quantity * Number(item.unitPrice),
    };
  });
};

const createInvoice = async (prismaClient, payment) => {
  const invoiceNumber = await generateInvoiceNumber();
  const snapshot = await buildLineItemsSnapshot(payment.entityType, payment.entityId);
  const subtotal = Number(payment.grossAmount);
  const discountAmount = Number(payment.discountAmount ?? 0);
  const totalAmount = Number(payment.amount);

  return prismaClient.invoice.create({
    data: {
      paymentId: payment.id,
      invoiceNumber,
      entityType: payment.entityType,
      entityId: payment.entityId,
      userId: payment.userId,
      lineItemsSnapshot: snapshot,
      subtotal,
      discountAmount,
      taxAmount: 0,
      totalAmount,
      couponCode: payment.couponCode,
    },
  });
};

// ── Public: create Razorpay order or COD payment ─────────

const createOrder = async ({ entityType, entityId, userId, couponCode, method }) => {
  // Prevent duplicate payment
  const existing = await prisma.payment.findFirst({
    where: { entityType, entityId, status: 'CAPTURED' },
  });
  if (existing) {
    const err = new Error('This booking/order has already been paid');
    err.statusCode = 409;
    throw err;
  }

  // Fetch entity amount
  let grossAmount;
  if (entityType === 'BOOKING') {
    const booking = await prisma.booking.findUnique({ where: { id: entityId }, select: { totalAmount: true } });
    if (!booking) { const e = new Error('Booking not found'); e.statusCode = 404; throw e; }
    grossAmount = Number(booking.totalAmount);
  } else if (entityType === 'MEMBERSHIP') {
    const membership = await prisma.membership.findUnique({ where: { id: entityId }, select: { price: true } });
    if (!membership) { const e = new Error('Membership not found'); e.statusCode = 404; throw e; }
    grossAmount = Number(membership.price);
  } else {
    const order = await prisma.order.findUnique({ where: { id: entityId }, select: { totalAmount: true } });
    if (!order) { const e = new Error('Order not found'); e.statusCode = 404; throw e; }
    grossAmount = Number(order.totalAmount);
  }

  // Apply coupon if provided
  let couponId = null;
  let discountAmount = 0;
  let finalAmount = grossAmount;
  let couponCodeStored = null;
  if (couponCode) {
    const coupon = await prisma.coupon.findUnique({ where: { code: couponCode.toUpperCase() } });
    if (coupon && coupon.isActive) {
      if (coupon.type === 'FLAT') {
        discountAmount = Math.min(Number(coupon.value), grossAmount);
      } else {
        discountAmount = Math.min(
          (grossAmount * Number(coupon.value)) / 100,
          Number(coupon.maxDiscount ?? Infinity)
        );
      }
      finalAmount = Math.max(0, grossAmount - discountAmount);
      couponId = coupon.id;
      couponCodeStored = coupon.code;
    }
  }

  // COD path
  if (method === 'COD') {
    const payment = await prisma.payment.create({
      data: {
        entityType,
        entityId,
        userId,
        provider: 'MANUAL',
        status: 'COD_PENDING',
        method: 'COD',
        grossAmount,
        discountAmount,
        amount: finalAmount,
        couponId,
        couponCode: couponCodeStored,
      },
    });

    await prisma.paymentLog.create({
      data: {
        paymentId: payment.id,
        toStatus: 'COD_PENDING',
        trigger: 'API:create_cod',
      },
    });

    // Confirm entity immediately for COD
    if (entityType === 'BOOKING') {
      await prisma.booking.update({ where: { id: entityId }, data: { status: 'CONFIRMED' } });
      sendConfirmationEmailsOnce(payment.id, {
        paymentMethod: 'Cash on Delivery',
        paymentStatus: 'Pending (Cash on Delivery)',
      }).catch((err) => console.error('[confirmation email] failed:', err?.message));
    } else if (entityType === 'MEMBERSHIP') {
      await activateMembership(prisma, entityId);
      sendConfirmationEmailsOnce(payment.id, {
        paymentMethod: 'Cash on Delivery',
        paymentStatus: 'Pending (Cash on Delivery)',
      }).catch((err) => console.error('[confirmation email] failed:', err?.message));
    } else {
      await prisma.order.update({ where: { id: entityId }, data: { status: 'CONFIRMED' } });
    }

    return { paymentId: payment.id, status: 'COD_PENDING', method: 'COD' };
  }

  // Razorpay path
  const mode = await getRazorpayMode();
  const razorpay = await getRazorpay();
  const rzpOrder = await razorpay.orders.create({
    amount: Math.round(finalAmount * 100), // paise
    currency: 'INR',
    receipt: `${entityType.toLowerCase()}_${entityId.slice(-8)}`,
  });

  const payment = await prisma.payment.create({
    data: {
      entityType,
      entityId,
      userId,
      provider: 'RAZORPAY',
      status: 'CREATED',
      grossAmount,
      discountAmount,
      amount: finalAmount,
      razorpayOrderId: rzpOrder.id,
      couponId,
      couponCode: couponCodeStored,
    },
  });

  await prisma.paymentLog.create({
    data: { paymentId: payment.id, toStatus: 'CREATED', trigger: 'API:create_order' },
  });

  return {
    paymentId: payment.id,
    razorpayOrderId: rzpOrder.id,
    amount: finalAmount,
    currency: 'INR',
    key: process.env[`RAZORPAY_KEY_ID_${mode.toUpperCase()}`],
  };
};

// ── Public: verify Razorpay signature ────────────────────

const verifyPayment = async ({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) => {
  const mode = await getRazorpayMode();
  const secret = process.env[`RAZORPAY_KEY_SECRET_${mode.toUpperCase()}`];
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  if (expected !== razorpaySignature) {
    const err = new Error('Invalid payment signature');
    err.statusCode = 400;
    throw err;
  }

  const payment = await prisma.payment.findUnique({ where: { razorpayOrderId } });
  if (!payment) { const e = new Error('Payment not found'); e.statusCode = 404; throw e; }
  if (payment.status === 'CAPTURED') {
    // A prior /verify already captured this (the frontend fires /verify more than
    // once). The confirmation email may not have gone out on that call, so trigger
    // the idempotent dispatch again — the atomic claim guarantees it still sends
    // at most once total.
    if (payment.entityType === 'BOOKING' || payment.entityType === 'MEMBERSHIP') {
      sendConfirmationEmailsOnce(payment.id, { paymentMethod: 'Online (Razorpay)', paymentStatus: 'Paid' })
        .catch((err) => console.error('[confirmation email] failed:', err?.message));
    }
    return { alreadyCaptured: true };
  }

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: { status: 'CAPTURED', razorpayPaymentId, razorpaySignature, capturedAt: new Date() },
    });
    await tx.paymentLog.create({
      data: {
        paymentId: payment.id,
        fromStatus: payment.status,
        toStatus: 'CAPTURED',
        trigger: 'API:verify',
        metadata: { razorpayPaymentId },
      },
    });
    if (payment.couponId) {
      const user = await tx.user.findUnique({ where: { id: payment.userId }, select: { phone: true } });
      if (user?.phone) {
        await tx.couponUsage.upsert({
          where: { couponId_userPhone: { couponId: payment.couponId, userPhone: user.phone } },
          update: {},
          create: { couponId: payment.couponId, userPhone: user.phone },
        });
        await tx.coupon.update({ where: { id: payment.couponId }, data: { usedCount: { increment: 1 } } });
      }
    }
    await createInvoice(tx, payment);
    if (payment.entityType === 'BOOKING') {
      await tx.booking.update({ where: { id: payment.entityId }, data: { status: 'CONFIRMED' } });
    } else if (payment.entityType === 'MEMBERSHIP') {
      await activateMembership(tx, payment.entityId);
    } else {
      await tx.order.update({ where: { id: payment.entityId }, data: { status: 'CONFIRMED' } });
    }
  });

  // Fire-and-forget confirmation email after the tx commits. Idempotent + race-safe
  // (see sendConfirmationEmailsOnce), so duplicate /verify calls can't double-send,
  // and a send missed here is recovered by the already-captured early-return branch.
  if (payment.entityType === 'BOOKING' || payment.entityType === 'MEMBERSHIP') {
    sendConfirmationEmailsOnce(payment.id, { paymentMethod: 'Online (Razorpay)', paymentStatus: 'Paid' })
      .catch((err) => console.error('[confirmation email] failed:', err?.message));
  }

  return { success: true };
};

// ── Admin: list payments ─────────────────────────────────

const getAll = async ({ entityType, status, method, from, to, page, limit }) => {
  const where = {};
  if (entityType) where.entityType = entityType;
  if (status) where.status = status;
  if (method) where.method = method;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }

  const skip = (page - 1) * limit;
  const [total, payments] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, name: true, phone: true } }, invoice: { select: { id: true, invoiceNumber: true } } },
    }),
  ]);

  return { total, page, limit, data: payments };
};

const getById = async (id) => {
  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, phone: true, email: true } },
      logs: { orderBy: { createdAt: 'asc' } },
      invoice: true,
      refunds: true,
    },
  });
  if (!payment) { const e = new Error('Payment not found'); e.statusCode = 404; throw e; }
  return payment;
};

const getByEntity = async (entityType, entityId) => {
  return prisma.payment.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: 'desc' },
    include: { invoice: { select: { id: true, invoiceNumber: true } } },
  });
};

// ── Admin: mark COD as collected ─────────────────────────

const codCollect = async (id) => {
  const payment = await prisma.payment.findUnique({ where: { id } });
  if (!payment) { const e = new Error('Payment not found'); e.statusCode = 404; throw e; }
  if (payment.status !== 'COD_PENDING') {
    const e = new Error('Payment is not in COD_PENDING status'); e.statusCode = 400; throw e;
  }

  let invoice;
  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id },
      data: { status: 'CAPTURED', capturedAt: new Date() },
    });
    await tx.paymentLog.create({
      data: { paymentId: id, fromStatus: 'COD_PENDING', toStatus: 'CAPTURED', trigger: 'ADMIN:cod_collected' },
    });
    if (payment.couponId) {
      const user = await tx.user.findUnique({ where: { id: payment.userId }, select: { phone: true } });
      if (user?.phone) {
        await tx.couponUsage.upsert({
          where: { couponId_userPhone: { couponId: payment.couponId, userPhone: user.phone } },
          update: {},
          create: { couponId: payment.couponId, userPhone: user.phone },
        });
        await tx.coupon.update({ where: { id: payment.couponId }, data: { usedCount: { increment: 1 } } });
      }
    }
    invoice = await createInvoice(tx, { ...payment, status: 'CAPTURED' });
  });

  return { success: true, invoiceId: invoice?.id };
};

// ── Admin: initiate refund ───────────────────────────────

const initiateRefund = async (id, { amount, reason }) => {
  const payment = await prisma.payment.findUnique({ where: { id } });
  if (!payment) { const e = new Error('Payment not found'); e.statusCode = 404; throw e; }
  if (payment.status !== 'CAPTURED') {
    const e = new Error('Only captured payments can be refunded'); e.statusCode = 400; throw e;
  }
  if (!payment.razorpayPaymentId) {
    const e = new Error('No Razorpay payment ID on record'); e.statusCode = 400; throw e;
  }

  const razorpay = await getRazorpay();
  const rzpRefund = await razorpay.payments.refund(payment.razorpayPaymentId, {
    amount: Math.round(amount * 100),
    notes: { reason: reason ?? 'Admin initiated refund' },
  });

  const refund = await prisma.refund.create({
    data: {
      paymentId: id,
      razorpayRefundId: rzpRefund.id,
      amount,
      status: 'PENDING',
      reason,
    },
  });

  return refund;
};

module.exports = { createOrder, verifyPayment, getAll, getById, getByEntity, codCollect, initiateRefund };
