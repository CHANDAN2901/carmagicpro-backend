const { z } = require('zod');
const prisma = require('../../config/prisma');
const { generateBookingNumber, generateOrderNumber } = require('../../utils/entityNumber');
const { releaseStaleBookings, BOOKING_HOLD_MINS } = require('../../utils/releaseStaleBookings');
const { normalizePlate, isValidPlate, PLATE_ERROR } = require('../../utils/plate');
const { getAvailableSlots, toIST } = require('../slots/slots.service');
const couponsService = require('../coupons/coupons.service');
const {
  sendOrderConfirmationEmail,
  sendOrderNotificationToAdmin,
} = require('../../utils/mailer');

// Field-level error the apps can pin to an input (rendered by middleware/errorHandler).
const fieldError = (status, field, fieldMessage, code = 'VALIDATION_ERROR', message = fieldMessage) =>
  Object.assign(new Error(message), { statusCode: status, code, errors: [{ field, message: fieldMessage }] });

// Human-readable labels for notification emails.
const PAYMENT_METHOD_LABELS = { COD: 'Cash on Delivery', RAZORPAY: 'Online (Razorpay)' };
const paymentMethodLabel = (m) => PAYMENT_METHOD_LABELS[m] ?? m ?? '—';
// Orders/bookings are created PENDING; payment is collected later (COD on
// delivery/service, Razorpay before confirmation).
const paymentStatusLabel = () => 'Pending';

// GET /customer/me
const getProfile = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { id: true, name: true, email: true, phone: true, isVerified: true, createdAt: true },
    });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user });
  } catch (err) { next(err); }
};

const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z.string().regex(/^[6-9]\d{9}$/).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
});

// PATCH /customer/me
const updateProfile = async (req, res, next) => {
  try {
    const data = updateProfileSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.user.userId },
      data,
      select: { id: true, name: true, email: true, phone: true, isVerified: true, createdAt: true },
    });
    res.json({ success: true, user });
  } catch (err) {
    // email and phone are @unique — surface a friendly conflict instead of a 500.
    if (err?.code === 'P2002') {
      const target = Array.isArray(err.meta?.target) ? err.meta.target.join(',') : String(err.meta?.target ?? '');
      const label = target.includes('email') ? 'Email' : target.includes('phone') ? 'Phone number' : 'Value';
      return res.status(409).json({ success: false, message: `${label} is already in use by another account` });
    }
    next(err);
  }
};

const bookingInclude = {
  service: { select: { id: true, name: true, images: true, durationMins: true } },
  vehicleType: { select: { id: true, name: true } },
  carModel: { select: { id: true, name: true, brand: { select: { id: true, name: true } } } },
};

const PAYMENT_STATUS = { CAPTURED: 'PAID', FAILED: 'FAILED', REFUNDED: 'REFUNDED', PARTIALLY_REFUNDED: 'REFUNDED' };

// Raw booking row + the fields the website/mobile app read: IST slot, payment
// state, hold expiry and a price breakdown. `payments` = this booking's Payment
// rows, newest first. Coupons live on the Payment, so the amount actually
// charged is payment.amount; before any payment it is the booking's price.
const toBookingDto = (b, payments = []) => {
  const p = payments.find((x) => x.status === 'CAPTURED') ?? payments[0];
  const price = Number(b.totalAmount);
  const originalPrice = Number(b.originalPrice ?? b.totalAmount);
  const finalAmount = p ? Number(p.amount) : price;
  const slot = toIST(b.scheduledAt);
  return {
    ...b,
    slotDate: slot.date,
    slotTime: slot.time,
    paymentStatus: PAYMENT_STATUS[p?.status] ?? 'PENDING',
    paymentMethod: p ? (p.provider === 'RAZORPAY' ? 'ONLINE' : 'COD') : null,
    holdExpiresAt: b.status === 'PENDING' ? new Date(b.createdAt.getTime() + BOOKING_HOLD_MINS * 60 * 1000) : null,
    pricing: {
      originalPrice,
      discount: Math.max(0, originalPrice - price),
      couponCode: p?.couponCode ?? null,
      couponDiscount: Number(p?.discountAmount ?? 0),
      finalAmount,
      currency: 'INR',
    },
    totalAmount: finalAmount,
  };
};

const toBookingDtos = async (bookings) => {
  const payments = await prisma.payment.findMany({
    where: { entityType: 'BOOKING', entityId: { in: bookings.map((b) => b.id) } },
    orderBy: { createdAt: 'desc' },
    select: { entityId: true, status: true, provider: true, amount: true, discountAmount: true, couponCode: true },
  });
  return bookings.map((b) => toBookingDto(b, payments.filter((p) => p.entityId === b.id)));
};

// PATCH|POST /customer/bookings/:id/cancel
// Called when the customer dismisses/aborts checkout (or edits the booking) so the
// slot hold releases immediately instead of waiting on the lazy releaseStaleBookings sweep.
// Only unpaid PENDING holds can be cancelled here.
const cancelBooking = async (req, res, next) => {
  try {
    const { count } = await prisma.booking.updateMany({
      where: { id: req.params.id, userId: req.user.userId, status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });
    const booking = await prisma.booking.findFirst({
      where: { id: req.params.id, userId: req.user.userId },
      include: bookingInclude,
    });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    const [dto] = await toBookingDtos([booking]);
    res.json({ success: true, cancelled: count > 0, booking: dto, data: dto });
  } catch (err) { next(err); }
};

// GET /customer/bookings
const getMyBookings = async (req, res, next) => {
  try {
    // Drop abandoned (unpaid, expired) holds so they don't show up as bookings.
    await releaseStaleBookings();
    const bookings = await prisma.booking.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: 'desc' },
      include: bookingInclude,
    });
    const dtos = await toBookingDtos(bookings);
    res.json({ success: true, bookings: dtos, data: dtos });
  } catch (err) { next(err); }
};

// GET /customer/bookings/:id — confirmation screen + payment-status polling.
// 404 (not 403) for someone else's booking so ids can't be probed.
const getMyBooking = async (req, res, next) => {
  try {
    await releaseStaleBookings();
    const booking = await prisma.booking.findFirst({
      where: { id: req.params.id, userId: req.user.userId },
      include: bookingInclude,
    });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    const [dto] = await toBookingDtos([booking]);
    res.json({ success: true, booking: dto, data: dto });
  } catch (err) { next(err); }
};

// GET /customer/orders
const getMyOrders = async (req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, images: true } },
          },
        },
      },
    });
    res.json({ success: true, orders });
  } catch (err) { next(err); }
};

// GET /customer/vehicles
const getMyVehicles = async (req, res, next) => {
  try {
    const vehicles = await prisma.vehicle.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        vehicleType: { select: { id: true, name: true, slug: true } },
        carModel: {
          select: {
            id: true, name: true, fuelTypes: true,
            brand: { select: { id: true, name: true } },
          },
        },
      },
    });
    res.json({ success: true, vehicles });
  } catch (err) { next(err); }
};

const addVehicleSchema = z.object({
  // IDs are CUIDs (Prisma @default(cuid())), not UUIDs.
  vehicleTypeId: z.string().min(1).optional(),
  carModelId: z.string().min(1).optional(),
  fuelType: z.enum(['PETROL', 'DIESEL', 'CNG', 'ELECTRIC', 'HYBRID']).optional(),
  plateNumber: z.string({ error: PLATE_ERROR }).transform(normalizePlate).refine(isValidPlate, PLATE_ERROR),
});

// POST /customer/vehicles
const addVehicle = async (req, res, next) => {
  try {
    const data = addVehicleSchema.parse(req.body);

    let resolvedVehicleTypeId = data.vehicleTypeId;
    if (data.carModelId && !resolvedVehicleTypeId) {
      const carModel = await prisma.carModel.findUnique({
        where: { id: data.carModelId },
        select: { vehicleTypeId: true },
      });
      if (carModel) resolvedVehicleTypeId = carModel.vehicleTypeId;
    }
    if (!resolvedVehicleTypeId) throw fieldError(422, 'vehicleTypeId', 'Please select your vehicle type.');

    const vehicleType = await prisma.vehicleType.findUnique({ where: { id: resolvedVehicleTypeId } });
    if (!vehicleType) throw fieldError(422, 'vehicleTypeId', 'Please select your vehicle type.');

    const duplicate = await prisma.vehicle.findFirst({
      where: { userId: req.user.userId, plateNumber: data.plateNumber },
      select: { id: true },
    });
    if (duplicate) throw fieldError(409, 'plateNumber', 'This vehicle is already saved.', 'DUPLICATE_VEHICLE');

    const vehicle = await prisma.vehicle.create({
      data: {
        userId: req.user.userId,
        vehicleTypeId: resolvedVehicleTypeId,
        carModelId: data.carModelId ?? null,
        fuelType: data.fuelType ?? null,
        plateNumber: data.plateNumber,
      },
      include: {
        vehicleType: { select: { id: true, name: true, slug: true } },
        carModel: {
          select: {
            id: true, name: true, fuelTypes: true,
            brand: { select: { id: true, name: true } },
          },
        },
      },
    });
    res.status(201).json({ success: true, vehicle });
  } catch (err) { next(err); }
};

// DELETE /customer/vehicles/:id
const deleteVehicle = async (req, res, next) => {
  try {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: req.params.id } });
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });
    if (vehicle.userId !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    await prisma.vehicle.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Vehicle removed' });
  } catch (err) { next(err); }
};

const MAX_ADVANCE_DAYS = 60;

const requiredText = (message, max) => z.string({ error: message }).trim().min(1, message).max(max);

const addressDetailsSchema = z.object({
  building: requiredText('Enter your flat / house / building.', 200),
  street: requiredText('Enter your street or area.', 200),
  landmark: z.string().trim().max(200).optional(),
  city: requiredText('Enter your city.', 100),
  state: requiredText('Enter your state.', 100),
  pincode: z.string({ error: 'Pincode must be 6 digits.' }).trim().regex(/^[1-9]\d{5}$/, 'Pincode must be 6 digits.'),
});

const formatAddress = (a) => `${[a.building, a.street, a.landmark, a.city].filter(Boolean).join(', ')}, ${a.state} - ${a.pincode}`;

// Unknown keys (vehicleId, couponCode, paymentMethod, …) are stripped, not rejected.
const createBookingSchema = z.object({
  serviceId: requiredText('Please select a service.', 50),
  // IDs are CUIDs (Prisma @default(cuid())), not UUIDs.
  vehicleTypeId: z.string().min(1).optional(),
  carModelId: z.string().min(1).optional(),
  fuelType: z.enum(['PETROL', 'DIESEL', 'CNG', 'ELECTRIC', 'HYBRID']).optional(),
  // Optional, but normalised + validated when given.
  plateNumber: z.string().optional().transform(normalizePlate).refine((p) => !p || isValidPlate(p), PLATE_ERROR),
  slotDate: z.string({ error: 'Please select a date.' }).regex(/^\d{4}-\d{2}-\d{2}$/, 'Please select a date.'),
  slotTime: z.string({ error: 'Please select a time slot.' }).regex(/^\d{2}:\d{2}$/, 'Please select a time slot.'),
  isHomePickup: z.boolean().optional(),
  address: z.string().trim().max(500).optional(),
  addressDetails: addressDetailsSchema.optional(),
  notes: z.string().trim().max(500).optional(),
}).refine((d) => d.isHomePickup === false || d.address || d.addressDetails, {
  message: 'Please enter your address.', path: ['address'],
});

const fmtAmount = (n) => Number(n).toFixed(2);

// POST /customer/bookings
// Creates a PENDING booking = a 15-min slot hold until payment (see payments.service).
// Price is always computed here; coupons are applied at payment (create-order).
const createBooking = async (req, res, next) => {
  try {
    const data = createBookingSchema.parse(req.body);

    const today = toIST(new Date()).date;
    const lastDay = toIST(Date.now() + MAX_ADVANCE_DAYS * 24 * 60 * 60 * 1000).date;
    if (data.slotDate < today) throw fieldError(422, 'slotDate', 'Please pick today or a later date.');
    if (data.slotDate > lastDay) throw fieldError(422, 'slotDate', `You can book up to ${MAX_ADVANCE_DAYS} days ahead.`);

    const service = await prisma.service.findUnique({ where: { id: data.serviceId } });
    if (!service?.isActive) throw fieldError(422, 'serviceId', 'This service is not available right now.');

    // Vehicle details are mandatory (plate number stays optional). A booking must
    // resolve to a vehicle type — either picked directly or via the car model.
    const carModel = data.carModelId
      ? await prisma.carModel.findUnique({ where: { id: data.carModelId }, select: { vehicleTypeId: true } })
      : null;
    if (data.carModelId && !carModel) throw fieldError(422, 'carModelId', 'Please select your car model again.');
    const vehicleTypeId = data.vehicleTypeId ?? carModel?.vehicleTypeId;
    const vehicleType = vehicleTypeId && await prisma.vehicleType.findUnique({ where: { id: vehicleTypeId }, select: { id: true } });
    if (!vehicleType) throw fieldError(422, 'vehicleTypeId', 'Please select your vehicle type.');

    // Pricing: ServicePricing[serviceId × vehicleTypeId] → service.price fallback
    const pricing = await prisma.servicePricing.findUnique({
      where: { serviceId_vehicleTypeId: { serviceId: data.serviceId, vehicleTypeId } },
    });

    const address = data.addressDetails ? formatAddress(data.addressDetails) : (data.address || null);

    const booking = await prisma.$transaction(async (tx) => {
      // Serialise bookings per day so two customers can't both take the last free team.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`booking:${data.slotDate}`}))`;
      const slots = await getAvailableSlots({ date: data.slotDate, serviceId: data.serviceId }, tx);
      if (slots.length === 0) throw fieldError(422, 'slotDate', 'Bookings are closed on this date. Please pick another day.');
      const slot = slots.find((s) => s.time === data.slotTime);
      if (!slot) throw fieldError(422, 'slotTime', 'This slot is outside working hours.');
      if (!slot.available) {
        throw fieldError(409, 'slotTime', 'This slot is no longer available.', 'SLOT_UNAVAILABLE',
          `Sorry, the ${data.slotTime} slot was just booked. Please pick another time.`);
      }

      return tx.booking.create({
        data: {
          bookingNumber: await generateBookingNumber(tx),
          userId: req.user.userId,
          serviceId: data.serviceId,
          vehicleTypeId,
          carModelId: data.carModelId ?? null,
          fuelType: data.fuelType ?? null,
          plateNumber: data.plateNumber,
          // Customer picks date/time in IST; the explicit offset keeps this
          // correct regardless of the server's own timezone (UTC on the VPS).
          scheduledAt: new Date(`${data.slotDate}T${data.slotTime}:00+05:30`),
          originalPrice: pricing?.originalPrice ?? null,
          totalAmount: pricing?.price ?? service.price,
          address,
          addressDetails: data.addressDetails,
          isHomePickup: data.isHomePickup ?? !!address,
          notes: data.notes || null,
          status: 'PENDING',
        },
        include: bookingInclude,
      });
    });

    const dto = toBookingDto(booking);
    res.status(201).json({ success: true, booking: dto, data: dto });
    // NOTE: booking confirmation emails are sent on successful payment
    // (see payments.service.js), not at creation — a PENDING booking is just a
    // temporary slot hold until Razorpay verifies / COD is placed.
  } catch (err) { next(err); }
};

const createOrderSchema = z.object({
  items: z.array(z.object({
    productId: z.string().min(1),
    variationId: z.string().min(1, 'variationId is required'),
    qty: z.number().int().positive(),
  })).min(1),
  address: z.string().min(1, 'Delivery address is required'),
  couponCode: z.string().optional(),
  paymentMethod: z.enum(['COD', 'RAZORPAY']).default('COD'),
  notes: z.string().optional(),
});

// POST /customer/orders
const createOrder = async (req, res, next) => {
  try {
    const data = createOrderSchema.parse(req.body);

    // Pricing lives on variations — lock the unit price server-side from the
    // chosen variation (a customer cannot influence what they're charged).
    const variationIds = data.items.map((i) => i.variationId);
    const variations = await prisma.productVariation.findMany({
      where: { id: { in: variationIds } },
      select: {
        id: true, productId: true, name: true, price: true, discountPrice: true,
        product: { select: { id: true, name: true, isActive: true } },
      },
    });
    const variationMap = Object.fromEntries(variations.map((v) => [v.id, v]));

    for (const item of data.items) {
      const variation = variationMap[item.variationId];
      if (!variation) return res.status(404).json({ success: false, message: `Variant ${item.variationId} not found` });
      // The variant must belong to the claimed product and the product must be active.
      if (variation.productId !== item.productId || !variation.product?.isActive) {
        return res.status(404).json({ success: false, message: `Variant ${item.variationId} is not available` });
      }
    }

    const unitPriceOf = (variation) => Number(variation.discountPrice ?? variation.price);

    // Coupons are applied at payment (POST /payments/create-order), which also
    // records usage — applying it here too would discount the order twice.
    const totalAmount = data.items.reduce((sum, item) => {
      return sum + unitPriceOf(variationMap[item.variationId]) * item.qty;
    }, 0);

    // Create the order and decrement variant stock atomically. The conditional
    // updateMany (stock >= qty) prevents two concurrent orders from overselling.
    let order;
    try {
      order = await prisma.$transaction(async (tx) => {
        for (const item of data.items) {
          const decremented = await tx.productVariation.updateMany({
            where: { id: item.variationId, stock: { gte: item.qty } },
            data: { stock: { decrement: item.qty } },
          });
          if (decremented.count === 0) {
            const variation = variationMap[item.variationId];
            const err = new Error(`Insufficient stock for ${variation.product.name} (${variation.name})`);
            err.statusCode = 400;
            throw err;
          }
        }

        const orderNumber = await generateOrderNumber(tx);

        return tx.order.create({
          data: {
            orderNumber,
            userId: req.user.userId,
            totalAmount,
            status: 'PENDING',
            notes: [
              data.address ? `Address: ${data.address}` : null,
              data.paymentMethod ? `Payment: ${data.paymentMethod}` : null,
              data.notes ?? null,
            ].filter(Boolean).join(' | ') || null,
            items: {
              create: data.items.map((item) => ({
                productId: item.productId,
                variationId: item.variationId,
                quantity: item.qty,
                unitPrice: unitPriceOf(variationMap[item.variationId]),
              })),
            },
          },
          include: {
            items: { include: { product: { select: { id: true, name: true, images: true } } } },
          },
        });
      });
    } catch (err) {
      if (err.statusCode === 400) return res.status(400).json({ success: false, message: err.message });
      throw err;
    }

    res.status(201).json({ success: true, order });

    // Fire-and-forget notifications — email failures must not fail the order.
    sendOrderEmails(req.user.userId, order, data).catch((err) =>
      console.error('[order email] failed:', err?.message));
  } catch (err) { next(err); }
};

// Builds the email payloads and dispatches customer + admin order emails.
const sendOrderEmails = async (userId, order, data) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, phone: true },
  });

  // The coupon is applied later at payment; preview it so the email shows what they'll pay.
  let amount = Number(order.totalAmount);
  if (data.couponCode) {
    amount = await couponsService.apply({ code: data.couponCode, amount, userPhone: user?.phone })
      .then((c) => c.finalAmount, () => amount);
  }

  const items = (order.items ?? []).map((it) => ({
    name: it.product?.name ?? 'Item',
    qty: it.quantity,
    amount: fmtAmount(Number(it.unitPrice) * it.quantity),
  }));

  const payload = {
    orderNumber: order.orderNumber,
    customerName: user?.name ?? 'Customer',
    customerEmail: user?.email ?? null,
    customerMobile: user?.phone ?? null,
    items,
    deliveryAddress: data.address ?? '—',
    paymentMethod: paymentMethodLabel(data.paymentMethod),
    paymentStatus: paymentStatusLabel(),
    amount: fmtAmount(amount),
    notes: data.notes ?? null,
  };

  const tasks = [sendOrderNotificationToAdmin(payload)];
  if (user?.email) tasks.push(sendOrderConfirmationEmail(user.email, payload));
  await Promise.allSettled(tasks);
};

module.exports = { getProfile, updateProfile, getMyBookings, getMyBooking, getMyOrders, getMyVehicles, addVehicle, deleteVehicle, createBooking, createOrder, cancelBooking };
