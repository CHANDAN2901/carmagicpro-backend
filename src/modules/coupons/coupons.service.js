const prisma = require('../../config/prisma');

const getAll = async () => {
  return prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
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

const apply = async ({ code, amount, userPhone }) => {
  const coupon = await prisma.coupon.findUnique({ where: { code: code.toUpperCase() } });

  if (!coupon || !coupon.isActive) {
    throw Object.assign(new Error('Invalid or inactive coupon'), { statusCode: 400 });
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

  const usage = await prisma.couponUsage.findUnique({
    where: { couponId_userPhone: { couponId: coupon.id, userPhone } },
  });
  if (usage) {
    throw Object.assign(new Error('You have already used this coupon'), { statusCode: 400 });
  }

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
    discount,
    finalAmount: Math.max(0, amount - discount),
  };
};

// Call this when booking is confirmed to record usage
const recordUsage = async (couponId, userPhone) => {
  await prisma.$transaction([
    prisma.couponUsage.create({ data: { couponId, userPhone } }),
    prisma.coupon.update({ where: { id: couponId }, data: { usedCount: { increment: 1 } } }),
  ]);
};

const bulkRemove = async (ids) => {
  let deleted = 0
  const failed = []
  for (const id of ids) {
    try { await remove(id); deleted++ } catch (e) { failed.push({ id, message: e.message }) }
  }
  return { deleted, failed }
}

module.exports = { getAll, getById, create, update, remove, bulkRemove, apply, recordUsage };
