const prisma = require('../../config/prisma');

const getAll = async ({ userId, status, page = 1, limit = 20 } = {}) => {
  const skip = (page - 1) * limit;
  const where = {};
  if (userId) where.userId = userId;
  if (status) where.status = status;

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      skip,
      take: limit,
      include: {
        user: { select: { id: true, name: true, phone: true } },
        service: { select: { id: true, name: true } },
      },
      orderBy: { scheduledAt: 'desc' },
    }),
    prisma.booking.count({ where }),
  ]);

  return { bookings, total, page, limit };
};

const getById = async (id) => {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, phone: true } },
      service: { select: { id: true, name: true, price: true, durationMins: true } },
    },
  });
  if (!booking) throw Object.assign(new Error('Booking not found'), { statusCode: 404 });
  return booking;
};

const create = async (data) => {
  return prisma.booking.create({
    data: { ...data, scheduledAt: new Date(data.scheduledAt) },
    include: {
      user: { select: { id: true, name: true, phone: true } },
      service: { select: { id: true, name: true } },
    },
  });
};

const update = async (id, data) => {
  await getById(id);
  const payload = { ...data };
  if (data.scheduledAt) payload.scheduledAt = new Date(data.scheduledAt);
  return prisma.booking.update({ where: { id }, data: payload });
};

const remove = async (id) => {
  await getById(id);
  return prisma.booking.delete({ where: { id } });
};

module.exports = { getAll, getById, create, update, remove };
