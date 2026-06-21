const { z } = require('zod');
const prisma = require('../../config/prisma');
const { generateBookingNumber, generateOrderNumber } = require('../../utils/entityNumber');
const {
  sendBookingConfirmationEmail,
  sendBookingNotificationToAdmin,
  sendOrderConfirmationEmail,
  sendOrderNotificationToAdmin,
} = require('../../utils/mailer');

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
  } catch (err) { next(err); }
};

// GET /customer/bookings
const getMyBookings = async (req, res, next) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        service: { select: { id: true, name: true, images: true } },
      },
    });
    res.json({ success: true, bookings });
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
  plateNumber: z.string().min(4).max(20).regex(/^[A-Z0-9 -]+$/i),
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
    if (!resolvedVehicleTypeId) {
      return res.status(400).json({ success: false, message: 'vehicleTypeId or carModelId is required' });
    }

    const vehicleType = await prisma.vehicleType.findUnique({ where: { id: resolvedVehicleTypeId } });
    if (!vehicleType) return res.status(404).json({ success: false, message: 'Vehicle type not found' });

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

const createBookingSchema = z.object({
  serviceId: z.string().min(1),
  // IDs are CUIDs (Prisma @default(cuid())), not UUIDs.
  vehicleTypeId: z.string().min(1).optional(),
  carModelId: z.string().min(1).optional(),
  fuelType: z.enum(['PETROL', 'DIESEL', 'CNG', 'ELECTRIC', 'HYBRID']).optional(),
  plateNumber: z.string().optional(),
  slotDate: z.string().min(1, 'Date is required'),
  slotTime: z.string().min(1, 'Time is required'),
  isHomePickup: z.boolean().optional().default(false),
  address: z.string().optional(),
  couponCode: z.string().optional(),
  paymentMethod: z.enum(['COD', 'RAZORPAY']).default('COD'),
  notes: z.string().optional(),
});

const fmtDate = (d) => {
  try {
    return new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return d; }
};
const fmtAmount = (n) => Number(n).toFixed(2);

// Builds the email payloads and dispatches customer + admin booking emails.
const sendBookingEmails = async (userId, booking, data) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, phone: true },
  });

  const vehicleModel = booking.carModel
    ? [booking.carModel.brand?.name, booking.carModel.name].filter(Boolean).join(' ')
    : null;
  const serviceAddress = data.address || (data.isHomePickup ? 'Home pickup' : 'Workshop / Walk-in');

  const payload = {
    bookingNumber: booking.bookingNumber,
    customerName: user?.name ?? 'Customer',
    customerEmail: user?.email ?? null,
    customerMobile: user?.phone ?? null,
    serviceName: booking.service?.name ?? '—',
    vehicleNumber: booking.plateNumber ?? '—',
    vehicleModel,
    bookingDate: fmtDate(data.slotDate),
    bookingTime: data.slotTime,
    serviceAddress,
    paymentMethod: paymentMethodLabel(data.paymentMethod),
    paymentStatus: paymentStatusLabel(),
    amount: fmtAmount(booking.totalAmount),
    notes: data.notes ?? null,
  };

  const tasks = [sendBookingNotificationToAdmin(payload)];
  if (user?.email) tasks.push(sendBookingConfirmationEmail(user.email, payload));
  await Promise.allSettled(tasks);
};

// POST /customer/bookings
const createBooking = async (req, res, next) => {
  try {
    const data = createBookingSchema.parse(req.body);

    const service = await prisma.service.findUnique({ where: { id: data.serviceId } });
    if (!service) return res.status(404).json({ success: false, message: 'Service not found' });

    const scheduledAt = new Date(`${data.slotDate}T${data.slotTime}:00`);
    if (isNaN(scheduledAt.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid date or time' });
    }

    // Resolve vehicleTypeId: use explicit value or derive from carModelId
    let resolvedVehicleTypeId = data.vehicleTypeId ?? null;
    if (data.carModelId && !resolvedVehicleTypeId) {
      const carModel = await prisma.carModel.findUnique({
        where: { id: data.carModelId },
        select: { vehicleTypeId: true },
      });
      if (carModel) resolvedVehicleTypeId = carModel.vehicleTypeId;
    }

    // Pricing: ServicePricing[serviceId × vehicleTypeId] → service.price fallback
    let totalAmount = Number(service.price);
    if (resolvedVehicleTypeId) {
      const pricing = await prisma.servicePricing.findUnique({
        where: {
          serviceId_vehicleTypeId: { serviceId: data.serviceId, vehicleTypeId: resolvedVehicleTypeId },
        },
      });
      if (pricing) totalAmount = Number(pricing.price);
    }

    // Apply coupon discount
    if (data.couponCode) {
      const coupon = await prisma.coupon.findFirst({
        where: { code: data.couponCode, isActive: true },
      });
      if (coupon) {
        if (coupon.type === 'PERCENT') {
          totalAmount = totalAmount - (totalAmount * Number(coupon.value)) / 100;
          if (coupon.maxDiscount !== null) totalAmount = Math.max(totalAmount, Number(totalAmount) - Number(coupon.maxDiscount));
        } else {
          totalAmount = totalAmount - Number(coupon.value);
        }
        totalAmount = Math.max(0, totalAmount);
      }
    }

    const bookingNumber = await generateBookingNumber();

    const booking = await prisma.booking.create({
      data: {
        bookingNumber,
        userId: req.user.userId,
        serviceId: data.serviceId,
        vehicleTypeId: resolvedVehicleTypeId,
        carModelId: data.carModelId ?? null,
        fuelType: data.fuelType ?? null,
        plateNumber: data.plateNumber ?? null,
        scheduledAt,
        totalAmount,
        notes: [
          data.isHomePickup ? 'Home pickup' : null,
          data.address ? `Address: ${data.address}` : null,
          data.paymentMethod ? `Payment: ${data.paymentMethod}` : null,
          data.notes ?? null,
        ].filter(Boolean).join(' | ') || null,
        status: 'PENDING',
      },
      include: {
        service: { select: { id: true, name: true, price: true } },
        vehicleType: { select: { id: true, name: true } },
        carModel: {
          select: {
            id: true, name: true,
            brand: { select: { name: true } },
          },
        },
      },
    });

    res.status(201).json({ success: true, booking });

    // Fire-and-forget notifications — email failures must not fail the booking.
    sendBookingEmails(req.user.userId, booking, data).catch((err) =>
      console.error('[booking email] failed:', err?.message));
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

    let totalAmount = data.items.reduce((sum, item) => {
      return sum + unitPriceOf(variationMap[item.variationId]) * item.qty;
    }, 0);

    if (data.couponCode) {
      const coupon = await prisma.coupon.findFirst({ where: { code: data.couponCode, isActive: true } });
      if (coupon) {
        if (coupon.type === 'PERCENT') {
          totalAmount = totalAmount - (totalAmount * Number(coupon.value)) / 100;
        } else {
          totalAmount = totalAmount - Number(coupon.value);
        }
        totalAmount = Math.max(0, totalAmount);
      }
    }

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
    amount: fmtAmount(order.totalAmount),
    notes: data.notes ?? null,
  };

  const tasks = [sendOrderNotificationToAdmin(payload)];
  if (user?.email) tasks.push(sendOrderConfirmationEmail(user.email, payload));
  await Promise.allSettled(tasks);
};

module.exports = { getProfile, updateProfile, getMyBookings, getMyOrders, getMyVehicles, addVehicle, deleteVehicle, createBooking, createOrder };
