const prisma = require('../../config/prisma');
const { generateBookingNumber } = require('../../utils/entityNumber');
const { releaseStaleBookings } = require('../../utils/releaseStaleBookings');
const { createInvoice, createPaymentLink, sendConfirmationEmailsOnce } = require('../payments/payments.service');
const couponsService = require('../coupons/coupons.service');
const { checkSlot, toIST } = require('../slots/slots.service');

const SLOT_ERRORS = {
  CLOSED: 'Bookings are closed on this date',
  OUTSIDE_HOURS: 'This time is not a valid slot within working hours',
  TAKEN: 'This slot is fully booked. Please pick another time',
};

// Same capacity rule as the customer site. Admin may log past slots (walk-ins
// recorded after the fact), so only capacity / working hours / blocked dates apply.
const assertSlotFree = async (tx, { scheduledAt, serviceId, excludeBookingId }) => {
  const { date, time } = toIST(scheduledAt);
  const reason = await checkSlot(tx, { date, time, serviceId, excludeBookingId, ignorePast: true });
  if (reason) throw Object.assign(new Error(SLOT_ERRORS[reason]), { statusCode: 409 });
};

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
  const { paymentMethod, couponCode, ...bookingData } = data;
  if (couponCode && !paymentMethod) {
    throw Object.assign(new Error('Pick how the payment was collected to apply a coupon'), { statusCode: 400 });
  }
  // Coupon (optional) is validated like the customer checkout and lives on the
  // Payment (gross / discount / amount); booking.totalAmount stays the list price.
  const amounts = await couponsService.paymentFieldsFor({
    code: couponCode, amount: bookingData.totalAmount, userId: bookingData.userId, plateNumber: bookingData.plateNumber,
  });
  const { userPhone, ...paymentAmounts } = amounts;
  const bookingNumber = await generateBookingNumber();
  const bookingInclude = {
    user: { select: { id: true, name: true, phone: true } },
    service: { select: { id: true, name: true } },
  };

  const scheduledAt = new Date(bookingData.scheduledAt);
  const insertBooking = async (tx, status) => {
    await assertSlotFree(tx, { scheduledAt, serviceId: bookingData.serviceId });
    return tx.booking.create({
      data: { ...bookingData, bookingNumber, scheduledAt, ...(status && { status }) },
      include: bookingInclude,
    });
  };

  if (!paymentMethod) return prisma.$transaction((tx) => insertBooking(tx));

  // Admin sends a Razorpay payment link instead of collecting payment in
  // person: booking stays PENDING until the customer actually pays (confirmed
  // by the payment_link.paid webhook, or the admin's manual recheck).
  if (paymentMethod === 'PAYMENT_LINK') {
    const booking = await prisma.$transaction((tx) => insertBooking(tx, 'PENDING'));
    const link = await createPaymentLink({ bookingId: booking.id, userId: booking.userId, ...paymentAmounts });
    return { ...booking, paymentLink: link };
  }

  // Admin manual entry: payment already collected in person (cash/card swipe),
  // so the booking is confirmed immediately and a matching Payment + Invoice
  // are created in the same transaction — no Razorpay/COD flow involved.
  const { booking, payment } = await prisma.$transaction(async (tx) => {
    const booking = await insertBooking(tx, 'CONFIRMED');

    const payment = await tx.payment.create({
      data: {
        entityType: 'BOOKING',
        entityId: booking.id,
        userId: booking.userId,
        provider: 'MANUAL',
        status: 'CAPTURED',
        method: paymentMethod,
        ...paymentAmounts,
        capturedAt: new Date(),
      },
    });
    await tx.paymentLog.create({
      data: { paymentId: payment.id, toStatus: 'CAPTURED', trigger: 'ADMIN:manual_booking' },
    });
    if (payment.couponId) {
      await couponsService.recordUsage(tx, { couponId: payment.couponId, userPhone, plateNumber: booking.plateNumber });
    }
    await createInvoice(tx, payment);

    return { booking, payment };
  });

  // Same confirmation emails the customer gets after paying on the website.
  sendConfirmationEmailsOnce(payment.id, { paymentMethod: paymentMethod === 'CARD' ? 'Card' : 'Cash', paymentStatus: 'Paid' })
    .catch((err) => console.error('[confirmation email] failed:', err?.message));
  return booking;
};

const update = async (id, data) => {
  const existing = await getById(id);
  const payload = { ...data };
  if (data.scheduledAt) payload.scheduledAt = new Date(data.scheduledAt);
  const moved = (payload.scheduledAt && payload.scheduledAt.getTime() !== existing.scheduledAt.getTime())
    || (data.serviceId && data.serviceId !== existing.serviceId)
    || (existing.status === 'CANCELLED' && data.status && data.status !== 'CANCELLED'); // un-cancel reclaims the slot

  return prisma.$transaction(async (tx) => {
    if (moved && (data.status ?? existing.status) !== 'CANCELLED') {
      await assertSlotFree(tx, {
        scheduledAt: payload.scheduledAt ?? existing.scheduledAt,
        serviceId: data.serviceId ?? existing.serviceId,
        excludeBookingId: id,
      });
    }
    return tx.booking.update({ where: { id }, data: payload });
  });
};

const remove = async (id) => {
  await getById(id);
  return prisma.booking.delete({ where: { id } });
};

module.exports = { getAll, getForExport, getById, create, update, remove };
