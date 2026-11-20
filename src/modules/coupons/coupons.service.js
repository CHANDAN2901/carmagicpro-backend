const prisma = require('../../config/prisma');
const { normalizePlate } = require('../../utils/plate');

const getAll = async () => {
  // Membership wash coupons are listed on their membership, not here.
  return prisma.coupon.findMany({ where: { membershipId: null }, orderBy: { createdAt: 'desc' } });
};

const getById = async (id) => {
  const coupon = await prisma.coupon.findUnique({ where: { id } });
  if (!coupon) throw Object.assign(new Error('Coupon not found'), { statusCode: 404 });
  return coupon;
};

const create = async (data) => {
  return prisma.coupon.create({
    data: {
      ...data,
      validFrom: new Date(data.validFrom),
      validTo: new Date(data.validTo),
    },
  });
};

const update = async (id, data) => {
  await getById(id);
  const updateData = { ...data };
  if (data.validFrom) updateData.validFrom = new Date(data.validFrom);
  if (data.validTo) updateData.validTo = new Date(data.validTo);
  return prisma.coupon.update({ where: { id }, data: updateData });
};

const remove = async (id) => {
  await getById(id);
  await prisma.payment.updateMany({ where: { couponId: id }, data: { couponId: null } });
  return prisma.coupon.delete({ where: { id } });
};


// One use per customer: blocked if this phone OR this car has used it before
// (so switching cars, or booking without a plate, doesn't allow a second use).
const findUsage = async (couponId, userPhone, plateNumber) => {
  const plate = normalizePlate(plateNumber);
  const OR = [userPhone && { userPhone }, plate && { plateNumber: plate }].filter(Boolean);
  if (!OR.length) return null;
  return prisma.couponUsage.findFirst({ where: { couponId, OR } });
};

const assertNotUsed = async ({ couponId, userPhone, plateNumber }) => {
  const usage = await findUsage(couponId, userPhone, plateNumber);
  if (usage) {
    throw Object.assign(new Error('You have already used this coupon'), { statusCode: 400 });
  }
};

const bad = (message) => Object.assign(new Error(message), { statusCode: 400 });

// entityType ('BOOKING' | 'ORDER' | 'MEMBERSHIP') is what the coupon is being used
// on; it's optional only for the public preview.
const apply = async ({ code, amount, userPhone, plateNumber, entityType }) => {
  const coupon = await prisma.coupon.findUnique({ where: { code: code.toUpperCase() } });

  if (!coupon || !coupon.isActive) {
    throw Object.assign(new Error('Invalid or inactive coupon'), { statusCode: 400 });
  }

  // Service coupons work on bookings + memberships, product coupons on shop orders.
  if (entityType && coupon.appliesTo !== 'ALL' && coupon.appliesTo !== (entityType === 'ORDER' ? 'PRODUCT' : 'SERVICE')) {
    throw bad(coupon.appliesTo === 'PRODUCT' ? 'This coupon is valid only on products' : 'This coupon is valid only on services');
  }

  // A membership wash coupon: only its member, only on a service booking.
  if (coupon.membershipId) {
    if (entityType && entityType !== 'BOOKING') throw bad('Membership wash coupons can only be used on a service booking');
    const membership = await prisma.membership.findUnique({
      where: { id: coupon.membershipId },
      select: { status: true, user: { select: { phone: true } } },
    });
    if (membership?.status !== 'ACTIVE') throw bad('This membership is not active');
    if (!userPhone || membership.user.phone !== userPhone) throw bad("This coupon belongs to another customer's membership");
    if (coupon.usedCount >= (coupon.usageLimit ?? 1)) throw bad('This wash coupon has already been used');
  }

  const now = new Date();
  const validFrom = new Date(coupon.validFrom);
  validFrom.setHours(0, 0, 0, 0);
  const validTo = new Date(coupon.validTo);
  validTo.setHours(23, 59, 59, 999);
  if (now < validFrom) {
    throw Object.assign(new Error('Coupon is not yet active'), { statusCode: 400 });
  }
  if (now > validTo) {
    throw Object.assign(new Error('Coupon has expired'), { statusCode: 400 });
  }

  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    throw Object.assign(new Error('Coupon usage limit reached'), { statusCode: 400 });
  }

  if (coupon.minOrderAmount !== null && amount < Number(coupon.minOrderAmount)) {
    throw Object.assign(new Error(`Minimum order amount is ₹${coupon.minOrderAmount}`), { statusCode: 400 });
  }

  await assertNotUsed({ couponId: coupon.id, userPhone, plateNumber });

  let discount;
  if (coupon.type === 'FLAT') {
    discount = Math.min(Number(coupon.value), amount);
  } else {
    discount = (amount * Number(coupon.value)) / 100;
    if (coupon.maxDiscount !== null) discount = Math.min(discount, Number(coupon.maxDiscount));
  }

  discount = Math.round(discount * 100) / 100;

  return {
    couponId: coupon.id,
    code: coupon.code,
    isMembershipWash: !!coupon.membershipId,
    discount,
    finalAmount: Math.max(0, amount - discount),
  };
};

// Admin manual entry: validate `code` for this customer/car (same checks as the
// customer checkout) and return the Payment fields to store. No code → no discount.
const paymentFieldsFor = async ({ code, amount, userId, plateNumber, entityType }) => {
  const gross = Number(amount);
  if (!code) return { grossAmount: gross, discountAmount: 0, amount: gross, couponId: null, couponCode: null };
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true } });
  const applied = await apply({ code, amount: gross, userPhone: user?.phone, plateNumber, entityType });
  return {
    grossAmount: gross,
    discountAmount: applied.discount,
    amount: applied.finalAmount,
    couponId: applied.couponId,
    couponCode: applied.code,
    userPhone: user?.phone,
  };
};

// Call this when payment is captured to record usage. Idempotent: a retried
// capture (webhook + verify racing) neither fails on the unique constraints nor
// counts the use twice.
const recordUsage = async (tx, { couponId, userPhone, plateNumber }) => {
  const { count } = await tx.couponUsage.createMany({
    data: [{ couponId, userPhone, plateNumber: normalizePlate(plateNumber) }],
    skipDuplicates: true,
  });
  if (count) await tx.coupon.update({ where: { id: couponId }, data: { usedCount: { increment: 1 } } });
};

// A cancelled booking gives its membership wash back (used=false); un-cancelling
// takes it again (used=true), unless the member has used that coupon since.
const setMembershipWashUsed = async (tx, bookingId, used) => {
  const payment = await tx.payment.findFirst({
    where: {
      entityType: 'BOOKING', entityId: bookingId, status: { in: ['CAPTURED', 'COD_PENDING'] },
      coupon: { membershipId: { not: null } },
    },
    select: { couponId: true, coupon: { select: { usedCount: true } }, user: { select: { phone: true } } },
  });
  if (!payment) return;
  if (!used) {
    const { count } = await tx.couponUsage.deleteMany({ where: { couponId: payment.couponId } });
    if (count) await tx.coupon.update({ where: { id: payment.couponId }, data: { usedCount: { decrement: count } } });
    return;
  }
  if (payment.coupon.usedCount > 0) {
    throw Object.assign(new Error("This booking's membership wash coupon has been used again since — create a new booking instead"), { statusCode: 409 });
  }
  await recordUsage(tx, { couponId: payment.couponId, userPhone: payment.user.phone });
};

const bulkRemove = async (ids) => {
  let deleted = 0
  const failed = []
  for (const id of ids) {
    try { await remove(id); deleted++ } catch (e) { failed.push({ id, message: e.message }) }
  }
  return { deleted, failed }
}

module.exports = { getAll, getById, create, update, remove, bulkRemove, apply, assertNotUsed, recordUsage, setMembershipWashUsed, paymentFieldsFor };
