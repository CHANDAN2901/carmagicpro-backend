const prisma = require('../../config/prisma');
const { generateBookingNumber } = require('../../utils/entityNumber');
const { releaseStaleBookings } = require('../../utils/releaseStaleBookings');
const { createInvoice, createPaymentLink } = require('../payments/payments.service');

const vehicleInclude = {
  vehicleType: { select: { id: true, name: true } },
  carModel: { select: { id: true, name: true, brand: { select: { name: true } } } },
};

const getAll = async ({ userId, status, search, sortBy = 'scheduledAt', sortOrder = 'desc', page = 1, limit = 20 } = {}) => {
  await releaseStaleBookings();
  const skip = (page - 1) * limit;
  const where = {};
  if (userId) where.userId = userId;
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { bookingNumber: { contains: search, mode: 'insensitive' } },
      { plateNumber: { contains: search, mode: 'insensitive' } },
      { user: { name: { contains: search, mode: 'insensitive' } } },
      { user: { phone: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      skip,
      take: limit,
      include: {
        user: { select: { id: true, name: true, phone: true } },
        service: { select: { id: true, name: true } },
        ...vehicleInclude,
      },
      orderBy: { [sortBy]: sortOrder },
    }),
    prisma.booking.count({ where }),
  ]);

  return { bookings, total, page, limit };
};

// All bookings created within an inclusive date range, with relations needed
// for the Excel export. No pagination — the range bounds the result size.
const getForExport = async ({ gte, lte }) => {
  return prisma.booking.findMany({
    where: { createdAt: { gte, lte } },
    include: {
      user: { select: { name: true, email: true, phone: true } },
      service: { select: { name: true } },
      vehicleType: { select: { name: true } },
      carModel: { select: { name: true, brand: { select: { name: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });
};

const getById = async (id) => {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, phone: true, email: true, address: true } },
      service: { select: { id: true, name: true, price: true, durationMins: true } },
      ...vehicleInclude,
    },
  });
  if (!booking) throw Object.assign(new Error('Booking not found'), { statusCode: 404 });
  return booking;
};

const create = async (data) => {
  const { paymentMethod, ...bookingData } = data;
  const bookingNumber = await generateBookingNumber();
  const bookingInclude = {
    user: { select: { id: true, name: true, phone: true } },
    service: { select: { id: true, name: true } },
  };

  // Admin manual entry: payment already collected in person (cash/card swipe),
  // so the booking is confirmed immediately and a matching Payment + Invoice
  // are created in the same transaction — no Razorpay/COD flow involved.
  if (!paymentMethod) {
    return prisma.booking.create({
      data: { ...bookingData, bookingNumber, scheduledAt: new Date(bookingData.scheduledAt) },
      include: bookingInclude,
    });
  }

  // Admin sends a Razorpay payment link instead of collecting payment in
  // person: booking stays PENDING until the customer actually pays (confirmed
  // by the payment_link.paid webhook, or the admin's manual recheck).
  if (paymentMethod === 'PAYMENT_LINK') {
    const booking = await prisma.booking.create({
      data: { ...bookingData, bookingNumber, scheduledAt: new Date(bookingData.scheduledAt), status: 'PENDING' },
      include: bookingInclude,
    });
    const link = await createPaymentLink({ bookingId: booking.id, userId: booking.userId, amount: Number(booking.totalAmount) });
    return { ...booking, paymentLink: link };
  }

  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.create({
      data: {
        ...bookingData,
        bookingNumber,
        scheduledAt: new Date(bookingData.scheduledAt),
        status: 'CONFIRMED',
      },
      include: bookingInclude,
    });

    const payment = await tx.payment.create({
      data: {
        entityType: 'BOOKING',
        entityId: booking.id,
        userId: booking.userId,
        provider: 'MANUAL',
        status: 'CAPTURED',
        method: paymentMethod,
        grossAmount: booking.totalAmount,
        amount: booking.totalAmount,
        capturedAt: new Date(),
      },
    });
    await tx.paymentLog.create({
      data: { paymentId: payment.id, toStatus: 'CAPTURED', trigger: 'ADMIN:manual_booking' },
    });
    await createInvoice(tx, payment);

    return booking;
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

module.exports = { getAll, getForExport, getById, create, update, remove };
