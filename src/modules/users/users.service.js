const prisma = require('../../config/prisma');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Never send passwordHash (or other auth columns) back to the CRM.
const userSelect = {
  id: true, name: true, email: true, phone: true, address: true, role: true,
  isActive: true, isVerified: true, createdAt: true,
};

// A "client" has paid for at least one service (a booking or a membership).
const PAID_SERVICE = {
  status: { in: ['CAPTURED', 'PARTIALLY_REFUNDED'] },
  entityType: { in: ['BOOKING', 'MEMBERSHIP'] },
};

const getAll = async ({ page = 1, limit = 20, search, type } = {}) => {
  const skip = (page - 1) * limit;
  const where = { role: 'CUSTOMER' };
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (type === 'CLIENT') where.payments = { some: PAID_SERVICE };
  if (type === 'USER') where.payments = { none: PAID_SERVICE };

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where, skip, take: limit, orderBy: { createdAt: 'desc' },
      select: { ...userSelect, _count: { select: { payments: { where: PAID_SERVICE } } } },
    }),
    prisma.user.count({ where }),
  ]);

  const users = rows.map(({ _count, ...u }) => ({ ...u, isClient: _count.payments > 0 }));
  return { users, total, page, limit };
};

const getById = async (id) => {
  const user = await prisma.user.findUnique({ where: { id }, select: userSelect });
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
  return user;
};

// Admin user-detail view: profile + paid-service summary.
const getDetail = async (id) => {
  const [user, paid] = await Promise.all([
    getById(id),
    prisma.payment.aggregate({ where: { userId: id, ...PAID_SERVICE }, _sum: { amount: true }, _count: true }),
  ]);
  return { ...user, isClient: paid._count > 0, totalSpent: Number(paid._sum.amount ?? 0) };
};

const create = async (data) => {
  const tempPassword = crypto.randomBytes(16).toString('hex');
  const passwordHash = await bcrypt.hash(tempPassword, 10);
  return prisma.user.create({ data: { ...data, passwordHash, isVerified: false }, select: userSelect });
};

const update = async (id, data) => {
  await getById(id);
  return prisma.user.update({ where: { id }, data, select: userSelect });
};

const tryDelete = async (fn) => {
  try { await fn(); } catch (e) {
    if (e?.code === 'P2021') return; // table does not exist yet — skip
    throw e;
  }
};

const remove = async (id) => {
  const user = await getById(id);
  if (user.role === 'ADMIN') throw Object.assign(new Error('Cannot delete an admin account'), { statusCode: 403 });

  await prisma.$transaction(async (tx) => {
    await tryDelete(() => tx.vehicle.deleteMany({ where: { userId: id } }));
    await tryDelete(() => tx.booking.deleteMany({ where: { userId: id } }));

    const paymentIds = (await tx.payment.findMany({ where: { userId: id }, select: { id: true } })).map((p) => p.id);
    if (paymentIds.length) {
      await tryDelete(() => tx.refund.deleteMany({ where: { paymentId: { in: paymentIds } } }));
    }
    await tryDelete(() => tx.invoice.deleteMany({ where: { userId: id } }));
    await tryDelete(() => tx.payment.deleteMany({ where: { userId: id } }));
    await tryDelete(() => tx.order.deleteMany({ where: { userId: id } }));
    await tryDelete(() => tx.membership.deleteMany({ where: { userId: id } }));
    if (user.phone) await tryDelete(() => tx.couponUsage.deleteMany({ where: { userPhone: user.phone } }));
    await tx.user.delete({ where: { id } });
  });
};

const bulkRemove = async (ids) => {
  let deleted = 0
  const failed = []
  for (const id of ids) {
    try { await remove(id); deleted++ } catch (e) { failed.push({ id, message: e.message }) }
  }
  return { deleted, failed }
}

module.exports = { getAll, getById, getDetail, create, update, remove, bulkRemove };
