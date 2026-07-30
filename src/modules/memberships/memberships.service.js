const prisma = require('../../config/prisma');
const { generateEntityNumber } = require('../../utils/entityNumber');
const { getPlan } = require('./memberships.plans');
const { createInvoice } = require('../payments/payments.service');

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

// Customer: create a PENDING membership snapshotting the chosen static plan.
// Activation (ACTIVE + expiry) happens later, on successful payment.
const create = async ({ userId, planKey, vehicleTypeId, carModelId, fuelType, plateNumber, address }) => {
  const plan = getPlan(planKey);
  if (!plan) throw Object.assign(new Error('Invalid plan'), { statusCode: 400 });

  const membershipNumber = await generateEntityNumber('MEMBERSHIP');
  return prisma.membership.create({
    data: {
      membershipNumber,
      userId,
      planKey: plan.planKey,
      planName: plan.name,
      washesPerYear: plan.washesPerYear,
      price: plan.price,
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
const createManual = async ({ userId, planKey, vehicleTypeId, carModelId, fuelType, plateNumber, address, paymentMethod }) => {
  const plan = getPlan(planKey);
  if (!plan) throw Object.assign(new Error('Invalid plan'), { statusCode: 400 });

  const membershipNumber = await generateEntityNumber('MEMBERSHIP');
  const startDate = new Date();
  const expiresAt = new Date(startDate);
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);

  return prisma.$transaction(async (tx) => {
    const membership = await tx.membership.create({
      data: {
        membershipNumber,
        userId,
        planKey: plan.planKey,
        planName: plan.name,
        washesPerYear: plan.washesPerYear,
        price: plan.price,
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
        grossAmount: membership.price,
        amount: membership.price,
        capturedAt: new Date(),
      },
    });
    await tx.paymentLog.create({
      data: { paymentId: payment.id, toStatus: 'CAPTURED', trigger: 'ADMIN:manual_membership' },
    });
    await createInvoice(tx, payment);

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

module.exports = { create, createManual, getMine, getAll, getById, getForExport, cancel };
