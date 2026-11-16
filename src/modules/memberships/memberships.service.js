const prisma = require('../../config/prisma');
const { generateEntityNumber } = require('../../utils/entityNumber');
const { quotePlan } = require('./memberships.pricing');
const { createInvoice, sendConfirmationEmailsOnce } = require('../payments/payments.service');
const couponsService = require('../coupons/coupons.service');

const vehicleInclude = {
  vehicleType: { select: { id: true, name: true } },
  carModel: { select: { id: true, name: true, brand: { select: { name: true } } } },
};

// Attaches the related payment + invoice to a set of memberships. Memberships are
// paid for through the shared Payment engine (entityType MEMBERSHIP, entityId =
// membership.id), so the invoice lives on the payment, not on the membership row.
const attachPayments = async (memberships) => {
  if (memberships.length === 0) return memberships;
  const ids = memberships.map((m) => m.id);
  const payments = await prisma.payment.findMany({
    where: { entityType: 'MEMBERSHIP', entityId: { in: ids } },
    orderBy: { createdAt: 'desc' },
    include: { invoice: { select: { id: true, invoiceNumber: true } } },
  });
  // First (most recent) payment wins per membership.
  const byEntity = {};
  for (const p of payments) if (!byEntity[p.entityId]) byEntity[p.entityId] = p;
  return memberships.map((m) => ({ ...m, payment: byEntity[m.id] ?? null }));
};

// The plan fields snapshotted onto a membership row from a server-side quote.
const planData = (plan) => ({
  planKey: plan.planKey,
  planName: plan.name,
  washesPerYear: plan.washesPerYear,
  price: plan.price,
  planItems: plan.planItems,
});

// Customer: create a PENDING membership snapshotting the quoted plan (priced for
// the chosen vehicle type). Activation (ACTIVE + expiry) happens on payment.
const create = async ({ userId, vehicleTypeId, carModelId, fuelType, plateNumber, address, ...planInput }) => {
  const plan = await quotePlan(planInput, vehicleTypeId);

  const membershipNumber = await generateEntityNumber('MEMBERSHIP');
  return prisma.membership.create({
    data: {
      membershipNumber,
      userId,
      ...planData(plan),
      status: 'PENDING',
      vehicleTypeId,
      carModelId: carModelId ?? null,
      fuelType: fuelType ?? null,
      plateNumber: plateNumber ?? null,
      address,
    },
  });
};

// Admin: manual entry for a membership paid in person (cash/card swipe).
// Activates immediately and creates a matching MANUAL/CAPTURED Payment + Invoice,
// mirroring bookings.service.create's manual path — no Razorpay/COD flow involved.
const createManual = async ({ userId, vehicleTypeId, carModelId, fuelType, plateNumber, address, paymentMethod, couponCode, ...planInput }) => {
  const plan = await quotePlan(planInput, vehicleTypeId);
  // Optional coupon, validated like the customer checkout; stored on the Payment.
  const { userPhone, ...paymentAmounts } = await couponsService.paymentFieldsFor({ code: couponCode, amount: plan.price, userId, plateNumber });

  const membershipNumber = await generateEntityNumber('MEMBERSHIP');
  const startDate = new Date();
  const expiresAt = new Date(startDate);
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);

  return prisma.$transaction(async (tx) => {
    const membership = await tx.membership.create({
      data: {
        membershipNumber,
        userId,
        ...planData(plan),
        status: 'ACTIVE',
        startDate,
        expiresAt,
        vehicleTypeId: vehicleTypeId ?? null,
        carModelId: carModelId ?? null,
        fuelType: fuelType ?? null,
        plateNumber: plateNumber ?? null,
        address: address ?? null,
      },
    });

    const payment = await tx.payment.create({
      data: {
        entityType: 'MEMBERSHIP',
        entityId: membership.id,
        userId,
        provider: 'MANUAL',
        status: 'CAPTURED',
        method: paymentMethod,
        ...paymentAmounts,
        capturedAt: new Date(),
      },
    });
    await tx.paymentLog.create({
      data: { paymentId: payment.id, toStatus: 'CAPTURED', trigger: 'ADMIN:manual_membership' },
    });
    if (payment.couponId) {
      await couponsService.recordUsage(tx, { couponId: payment.couponId, userPhone, plateNumber });
    }
    await createInvoice(tx, payment);

    return { membership, payment };
  }).then(({ membership, payment }) => {
    // Same confirmation emails the customer gets after paying on the website.
    sendConfirmationEmailsOnce(payment.id, { paymentMethod: paymentMethod === 'CARD' ? 'Card' : 'Cash', paymentStatus: 'Paid' })
      .catch((err) => console.error('[confirmation email] failed:', err?.message));
    return membership;
  });
};

// Customer: list the logged-in user's memberships (for the account view).
const getMine = async (userId) => {
  const memberships = await prisma.membership.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
  return attachPayments(memberships);
};

// Admin: paginated list with customer + payment/invoice.
const getAll = async ({ userId, status, page = 1, limit = 20 } = {}) => {
  const skip = (page - 1) * limit;
  const where = {};
  if (userId) where.userId = userId;
  if (status) where.status = status;

  const [memberships, total] = await Promise.all([
    prisma.membership.findMany({
      where,
      skip,
      take: limit,
      include: { user: { select: { id: true, name: true, phone: true, email: true } }, ...vehicleInclude },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.membership.count({ where }),
  ]);

  return { memberships: await attachPayments(memberships), total, page, limit };
};

const getById = async (id) => {
  const membership = await prisma.membership.findUnique({
    where: { id },
    include: { user: { select: { id: true, name: true, phone: true, email: true, address: true } }, ...vehicleInclude },
  });
  if (!membership) throw Object.assign(new Error('Membership not found'), { statusCode: 404 });
  const [withPayment] = await attachPayments([membership]);
  return withPayment;
};

// Admin export: all memberships created within an inclusive date range.
const getForExport = async ({ gte, lte }) => {
  return prisma.membership.findMany({
    where: { createdAt: { gte, lte } },
    include: { user: { select: { name: true, email: true, phone: true } } },
    orderBy: { createdAt: 'desc' },
  });
};

// Customer: cancel a still-PENDING membership (e.g. Razorpay checkout dismissed).
const cancel = async (id, userId) => {
  const { count } = await prisma.membership.updateMany({
    where: { id, userId, status: 'PENDING' },
    data: { status: 'CANCELLED' },
  });
  return count > 0;
};

// Admin: delete an abandoned PENDING membership (e.g. a dismissed checkout).
// Anything with money attached (captured / COD) must stay for the books.
const remove = async (id) => {
  const membership = await prisma.membership.findUnique({ where: { id }, select: { status: true } });
  if (!membership) throw Object.assign(new Error('Membership not found'), { statusCode: 404 });
  const paid = await prisma.payment.count({
    where: { entityType: 'MEMBERSHIP', entityId: id, status: { in: ['AUTHORIZED', 'CAPTURED', 'PARTIALLY_REFUNDED', 'REFUNDED', 'COD_PENDING'] } },
  });
  if (membership.status !== 'PENDING' || paid > 0) {
    throw Object.assign(new Error('Only unpaid PENDING memberships can be deleted'), { statusCode: 409 });
  }
  await prisma.$transaction([
    prisma.payment.deleteMany({ where: { entityType: 'MEMBERSHIP', entityId: id } }), // payment logs cascade
    prisma.membership.delete({ where: { id } }),
  ]);
};

module.exports = { create, createManual, remove, getMine, getAll, getById, getForExport, cancel };
