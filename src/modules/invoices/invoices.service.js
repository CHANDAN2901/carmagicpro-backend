const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const getAll = async ({ entityType, userId, from, to, page, limit }) => {
  const where = {};
  if (entityType) where.entityType = entityType;
  if (userId) where.userId = userId;
  if (from || to) {
    where.issuedAt = {};
    if (from) where.issuedAt.gte = new Date(from);
    if (to) where.issuedAt.lte = new Date(to);
  }

  const skip = (page - 1) * limit;
  const [total, invoices] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      skip,
      take: limit,
      orderBy: { issuedAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, phone: true } },
        payment: { select: { id: true, method: true, status: true } },
      },
    }),
  ]);

  return { total, page, limit, data: invoices };
};

const getById = async (id) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, phone: true, email: true } },
      payment: { select: { id: true, method: true, status: true, razorpayPaymentId: true } },
    },
  });
  if (!invoice) { const e = new Error('Invoice not found'); e.statusCode = 404; throw e; }
  return invoice;
};

module.exports = { getAll, getById };
