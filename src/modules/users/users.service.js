const prisma = require('../../config/prisma');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const getAll = async ({ page = 1, limit = 20, search } = {}) => {
  const skip = (page - 1) * limit;
  const baseWhere = { role: 'CUSTOMER' };
  const where = search
    ? {
        ...baseWhere,
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }
    : baseWhere;

  const [users, total] = await Promise.all([
    prisma.user.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
    prisma.user.count({ where }),
  ]);

  return { users, total, page, limit };
};

const getById = async (id) => {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
  return user;
};

const create = async (data) => {
  const tempPassword = crypto.randomBytes(16).toString('hex');
  const passwordHash = await bcrypt.hash(tempPassword, 10);
  return prisma.user.create({ data: { ...data, passwordHash, isVerified: false } });
};

const update = async (id, data) => {
  await getById(id);
  return prisma.user.update({ where: { id }, data });
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
    await tryDelete(() => tx.couponUsage.deleteMany({ where: { userEmail: user.email } }));
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

module.exports = { getAll, getById, create, update, remove, bulkRemove };
