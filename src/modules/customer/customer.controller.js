const { z } = require('zod');
const prisma = require('../../config/prisma');

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
      include: { vehicleType: { select: { id: true, name: true, slug: true } } },
    });
    res.json({ success: true, vehicles });
  } catch (err) { next(err); }
};

const addVehicleSchema = z.object({
  vehicleTypeId: z.string().cuid(),
  plateNumber: z.string().min(4).max(20).regex(/^[A-Z0-9 -]+$/i),
});

// POST /customer/vehicles
const addVehicle = async (req, res, next) => {
  try {
    const data = addVehicleSchema.parse(req.body);
    const vehicleType = await prisma.vehicleType.findUnique({ where: { id: data.vehicleTypeId } });
    if (!vehicleType) return res.status(404).json({ success: false, message: 'Vehicle type not found' });

    const vehicle = await prisma.vehicle.create({
      data: { userId: req.user.userId, ...data },
      include: { vehicleType: { select: { id: true, name: true, slug: true } } },
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
  vehicleTypeId: z.string().optional(),
  plateNumber: z.string().optional(),
  slotDate: z.string().min(1, 'Date is required'),
  slotTime: z.string().min(1, 'Time is required'),
  isHomePickup: z.boolean().optional().default(false),
  address: z.string().optional(),
  couponCode: z.string().optional(),
  paymentMethod: z.enum(['COD', 'RAZORPAY']).default('COD'),
  notes: z.string().optional(),
});

// POST /customer/bookings
const createBooking = async (req, res, next) => {
  try {
    const data = createBookingSchema.parse(req.body);

    const service = await prisma.service.findUnique({ where: { id: data.serviceId } });
    if (!service) return res.status(404).json({ success: false, message: 'Service not found' });

    // combine slotDate + slotTime into ISO datetime
    const scheduledAt = new Date(`${data.slotDate}T${data.slotTime}:00`);
    if (isNaN(scheduledAt.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid date or time' });
    }

    let totalAmount = Number(service.price);

    // apply coupon discount if provided
    if (data.couponCode) {
      const coupon = await prisma.coupon.findFirst({
        where: { code: data.couponCode, isActive: true },
      });
      if (coupon) {
        if (coupon.discountType === 'PERCENTAGE') {
          totalAmount = totalAmount - (totalAmount * Number(coupon.discountValue)) / 100;
        } else {
          totalAmount = totalAmount - Number(coupon.discountValue);
        }
        totalAmount = Math.max(0, totalAmount);
      }
    }

    const booking = await prisma.booking.create({
      data: {
        userId: req.user.userId,
        serviceId: data.serviceId,
        scheduledAt,
        totalAmount,
        notes: [
          data.plateNumber ? `Vehicle: ${data.plateNumber}` : null,
          data.isHomePickup ? `Home pickup` : null,
          data.address ? `Address: ${data.address}` : null,
          data.paymentMethod ? `Payment: ${data.paymentMethod}` : null,
          data.notes ?? null,
        ].filter(Boolean).join(' | ') || null,
        status: 'PENDING',
      },
      include: {
        service: { select: { id: true, name: true, price: true } },
      },
    });

    res.status(201).json({ success: true, booking });
  } catch (err) { next(err); }
};

const createOrderSchema = z.object({
  items: z.array(z.object({
    productId: z.string().min(1),
    qty: z.number().int().positive(),
    variationId: z.string().optional(),
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

    // fetch products to lock server-side prices
    const productIds = data.items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, price: true, stock: true },
    });
    const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

    for (const item of data.items) {
      const product = productMap[item.productId];
      if (!product) return res.status(404).json({ success: false, message: `Product ${item.productId} not found` });
      if (product.stock < item.qty) return res.status(400).json({ success: false, message: `Insufficient stock for ${product.name}` });
    }

    let totalAmount = data.items.reduce((sum, item) => {
      return sum + Number(productMap[item.productId].price) * item.qty;
    }, 0);

    if (data.couponCode) {
      const coupon = await prisma.coupon.findFirst({ where: { code: data.couponCode, isActive: true } });
      if (coupon) {
        if (coupon.discountType === 'PERCENTAGE') {
          totalAmount = totalAmount - (totalAmount * Number(coupon.discountValue)) / 100;
        } else {
          totalAmount = totalAmount - Number(coupon.discountValue);
        }
        totalAmount = Math.max(0, totalAmount);
      }
    }

    const order = await prisma.order.create({
      data: {
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
            quantity: item.qty,
            unitPrice: productMap[item.productId].price,
          })),
        },
      },
      include: {
        items: { include: { product: { select: { id: true, name: true, images: true } } } },
      },
    });

    // decrement stock
    await Promise.all(data.items.map((item) =>
      prisma.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.qty } },
      })
    ));

    res.status(201).json({ success: true, order });
  } catch (err) { next(err); }
};

module.exports = { getProfile, updateProfile, getMyBookings, getMyOrders, getMyVehicles, addVehicle, deleteVehicle, createBooking, createOrder };
