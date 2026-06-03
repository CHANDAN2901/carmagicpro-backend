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
      items: { include: { product: { select: { id: true, name: true, images: true } } } },
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

// Public: customer-facing order creation with stock validation and atomic deduction
const createPublic = async ({ userId, items, notes }) => {
  return prisma.$transaction(async (tx) => {
    // Validate stock for every item before touching anything
    for (const item of items) {
      const product = await tx.product.findUnique({
        where: { id: item.productId },
        select: { id: true, name: true, price: true, stock: true, isActive: true },
      });

      if (!product || !product.isActive) {
        const err = new Error(`Product not found: ${item.productId}`);
        err.statusCode = 404;
        throw err;
      }
      if (product.stock < item.quantity) {
        const err = new Error(
          `Insufficient stock for "${product.name}". Available: ${product.stock}, requested: ${item.quantity}`
        );
        err.statusCode = 422;
        throw err;
      }
      // Lock unit price to current DB price — customer cannot manipulate it
      item.unitPrice = Number(product.price);
    }

    // Deduct stock atomically
    for (const item of items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
    }

    const totalAmount = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

    return tx.order.create({
      data: {
        userId,
        notes,
        totalAmount,
        items: { create: items },
      },
      include: {
        items: {
          include: { product: { select: { id: true, name: true, price: true } } },
        },
      },
    });
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

module.exports = { getAll, getById, create, createPublic, update, remove };
