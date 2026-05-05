const prisma = require('../../config/prisma');

const getAll = async ({ userId, status, page = 1, limit = 20 } = {}) => {
  const skip = (page - 1) * limit;
  const where = {};
  if (userId) where.userId = userId;
  if (status) where.status = status;

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip,
      take: limit,
      include: {
        user: { select: { id: true, name: true, phone: true } },
        items: { include: { product: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.order.count({ where }),
  ]);

  return { orders, total, page, limit };
};

const getById = async (id) => {
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, phone: true } },
      items: { include: { product: { select: { id: true, name: true, imageUrl: true } } } },
    },
  });
  if (!order) throw Object.assign(new Error('Order not found'), { statusCode: 404 });
  return order;
};

const create = async ({ userId, items, notes }) => {
  const totalAmount = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

  return prisma.order.create({
    data: {
      userId,
      notes,
      totalAmount,
      items: { create: items },
    },
    include: {
      items: { include: { product: { select: { id: true, name: true } } } },
    },
  });
};

const update = async (id, data) => {
  await getById(id);
  return prisma.order.update({ where: { id }, data });
};

const remove = async (id) => {
  await getById(id);
  return prisma.order.delete({ where: { id } });
};

module.exports = { getAll, getById, create, update, remove };
