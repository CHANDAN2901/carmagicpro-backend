const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const vehicleTypes = [
  { name: 'Hatchback',        slug: 'hatchback'        },
  { name: 'Sedan',            slug: 'sedan'            },
  { name: 'SUV',              slug: 'suv'              },
  { name: 'Compact SUV',      slug: 'compact-suv'      },
  { name: 'MPV / MUV',        slug: 'mpv-muv'          },
  { name: 'Pickup Truck',     slug: 'pickup-truck'     },
  { name: 'Van',              slug: 'van'              },
  { name: 'Minivan',          slug: 'minivan'          },
  { name: 'Luxury Car',       slug: 'luxury-car'       },
  { name: 'Electric Vehicle', slug: 'electric-vehicle' },
  { name: 'Coupe',            slug: 'coupe'            },
  { name: 'Convertible',      slug: 'convertible'      },
  { name: 'Roadster',         slug: 'roadster'         },
  { name: 'Wagon / Estate',   slug: 'wagon-estate'     },
  { name: 'Fastback',         slug: 'fastback'         },
  { name: 'Liftback',         slug: 'liftback'         },
  { name: 'Limousine',        slug: 'limousine'        },
  { name: 'Sports Car',       slug: 'sports-car'       },
  { name: 'Muscle Car',       slug: 'muscle-car'       },
  { name: 'Supercar',         slug: 'supercar'         },
];

async function main() {
  // ── Admin ──────────────────────────────────────────────────
  const adminEmail = 'info@carmagicpro.com';
  const passwordHash = await bcrypt.hash('Admin123', 12);

  // Admins are Users with role ADMIN (the standalone Admin model was removed
  // in the email-auth refactor).
  const admin = await prisma.user.upsert({
    where:  { email: adminEmail },
    update: { passwordHash, isVerified: true, role: 'ADMIN' },
    create: { email: adminEmail, name: 'Admin', passwordHash, isVerified: true, role: 'ADMIN' },
  });

  console.log('✅ Admin:', admin.email, '/ password: Admin123');

  // ── Vehicle Types ──────────────────────────────────────────
  const vtMap = {};
  for (const vt of vehicleTypes) {
    const record = await prisma.vehicleType.upsert({
      where:  { slug: vt.slug },
      update: { name: vt.name },
      create: { name: vt.name, slug: vt.slug, isActive: true },
    });
    vtMap[vt.slug] = record.id;
  }
  console.log(`✅ ${vehicleTypes.length} vehicle types seeded`);

  // ── Invoice Counter ────────────────────────────────────────
  await prisma.invoiceCounter.upsert({
    where:  { id: 1 },
    update: {},
    create: { id: 1, lastSeq: 0 },
  });
  console.log('✅ InvoiceCounter initialized');

  // ── Categories ─────────────────────────────────────────────
  const categories = [
    { name: 'Exterior Wash',   slug: 'exterior-wash',   type: 'SERVICE',  description: 'Outer body cleaning services'       },
    { name: 'Interior Clean',  slug: 'interior-clean',  type: 'SERVICE',  description: 'Interior vacuuming and detailing'   },
    { name: 'Full Detailing',  slug: 'full-detailing',  type: 'SERVICE',  description: 'Complete car detailing packages'    },
    { name: 'Car Care Products', slug: 'car-care',      type: 'PRODUCT',  description: 'Shampoos, waxes, and accessories'  },
    { name: 'Accessories',     slug: 'accessories',     type: 'PRODUCT',  description: 'Seat covers, mats, and more'       },
    { name: 'Combo Packages',  slug: 'combo-packages',  type: 'BOTH',     description: 'Service + product combos'          },
  ];

  const catMap = {};
  for (const cat of categories) {
    const record = await prisma.category.upsert({
      where:  { slug: cat.slug },
      update: { name: cat.name, type: cat.type, description: cat.description },
      create: { name: cat.name, slug: cat.slug, type: cat.type, description: cat.description, isActive: true },
    });
    catMap[cat.slug] = record.id;
  }
  console.log(`✅ ${categories.length} categories seeded`);

  // ── Services ───────────────────────────────────────────────
  const services = [
    { name: 'Basic Exterior Wash',       slug: 'basic-exterior-wash',      categorySlug: 'exterior-wash',  price: 299,  durationMins: 30  },
    { name: 'Premium Exterior Wash',     slug: 'premium-exterior-wash',    categorySlug: 'exterior-wash',  price: 499,  durationMins: 45  },
    { name: 'Interior Vacuum Clean',     slug: 'interior-vacuum-clean',    categorySlug: 'interior-clean', price: 399,  durationMins: 40  },
    { name: 'Deep Interior Detailing',   slug: 'deep-interior-detailing',  categorySlug: 'interior-clean', price: 799,  durationMins: 90  },
    { name: 'Full Car Detailing',        slug: 'full-car-detailing',       categorySlug: 'full-detailing', price: 1499, durationMins: 150 },
    { name: 'Ceramic Coat Wash',         slug: 'ceramic-coat-wash',        categorySlug: 'full-detailing', price: 2499, durationMins: 180 },
    { name: 'Engine Bay Clean',          slug: 'engine-bay-clean',         categorySlug: 'full-detailing', price: 599,  durationMins: 60  },
    { name: 'Foam Wash + Wax Polish',    slug: 'foam-wash-wax-polish',     categorySlug: 'exterior-wash',  price: 699,  durationMins: 60  },
  ];

  const serviceMap = {};
  for (const svc of services) {
    const record = await prisma.service.upsert({
      where:  { slug: svc.slug },
      update: { name: svc.name, price: svc.price, durationMins: svc.durationMins },
      create: {
        name:        svc.name,
        slug:        svc.slug,
        categoryId:  catMap[svc.categorySlug],
        price:       svc.price,
        durationMins: svc.durationMins,
        isActive:    true,
      },
    });
    serviceMap[svc.slug] = record.id;
  }
  console.log(`✅ ${services.length} services seeded`);

  // ── Service Pricings (per vehicle type) ────────────────────
  const pricingMatrix = [
    { serviceSlug: 'basic-exterior-wash',    vehicleSlug: 'hatchback',  price: 299  },
    { serviceSlug: 'basic-exterior-wash',    vehicleSlug: 'sedan',      price: 349  },
    { serviceSlug: 'basic-exterior-wash',    vehicleSlug: 'suv',        price: 449  },
    { serviceSlug: 'premium-exterior-wash',  vehicleSlug: 'hatchback',  price: 499  },
    { serviceSlug: 'premium-exterior-wash',  vehicleSlug: 'sedan',      price: 599  },
    { serviceSlug: 'premium-exterior-wash',  vehicleSlug: 'suv',        price: 699  },
    { serviceSlug: 'full-car-detailing',     vehicleSlug: 'hatchback',  price: 1499 },
    { serviceSlug: 'full-car-detailing',     vehicleSlug: 'sedan',      price: 1799 },
    { serviceSlug: 'full-car-detailing',     vehicleSlug: 'suv',        price: 2199 },
    { serviceSlug: 'ceramic-coat-wash',      vehicleSlug: 'hatchback',  price: 2499 },
    { serviceSlug: 'ceramic-coat-wash',      vehicleSlug: 'sedan',      price: 2999 },
    { serviceSlug: 'ceramic-coat-wash',      vehicleSlug: 'suv',        price: 3499 },
  ];

  for (const pm of pricingMatrix) {
    if (!serviceMap[pm.serviceSlug] || !vtMap[pm.vehicleSlug]) continue;
    await prisma.servicePricing.upsert({
      where:  { serviceId_vehicleTypeId: { serviceId: serviceMap[pm.serviceSlug], vehicleTypeId: vtMap[pm.vehicleSlug] } },
      update: { price: pm.price },
      create: { serviceId: serviceMap[pm.serviceSlug], vehicleTypeId: vtMap[pm.vehicleSlug], price: pm.price },
    });
  }
  console.log(`✅ ${pricingMatrix.length} service pricings seeded`);

  // ── Products ───────────────────────────────────────────────
  // Pricing/stock live entirely on variations. A "simple" product is just a
  // product with one variant (named "Standard"). Multi-variant products list
  // each option; the website shows the lowest-priced variant on cards.
  const products = [
    {
      name: 'Car Shampoo 1L', slug: 'car-shampoo-1l', categorySlug: 'car-care',
      variations: [
        { name: '1L',    sku: 'SH-001',   price: 299, discountPrice: 249, stock: 50 },
        { name: '500ml', sku: 'SH-001-S', price: 179, discountPrice: null, stock: 30 },
        { name: '2L',    sku: 'SH-001-L', price: 499, discountPrice: null, stock: 20 },
      ],
    },
    {
      name: 'Microfiber Towel Set', slug: 'microfiber-towel-set', categorySlug: 'car-care',
      variations: [{ name: 'Standard', sku: 'MT-001', price: 499, discountPrice: 399, stock: 100 }],
    },
    {
      name: 'Dashboard Polish 200ml', slug: 'dashboard-polish-200ml', categorySlug: 'car-care',
      variations: [{ name: 'Standard', sku: 'DP-001', price: 349, discountPrice: null, stock: 30 }],
    },
    {
      name: 'Car Wax Paste 500g', slug: 'car-wax-paste-500g', categorySlug: 'car-care',
      variations: [
        { name: '500g', sku: 'WX-001',   price: 799, discountPrice: 699, stock: 20 },
        { name: '250g', sku: 'WX-001-S', price: 449, discountPrice: null, stock: 15 },
      ],
    },
    {
      name: 'Seat Cover - Universal', slug: 'seat-cover-universal', categorySlug: 'accessories',
      variations: [
        { name: 'Beige', sku: 'SC-001-B',  price: 1299, discountPrice: 999, stock: 20 },
        { name: 'Black', sku: 'SC-001-BL', price: 1299, discountPrice: 999, stock: 20 },
      ],
    },
    {
      name: 'Anti-Dust Floor Mats', slug: 'anti-dust-floor-mats', categorySlug: 'accessories',
      variations: [{ name: 'Standard', sku: 'FM-001', price: 699, discountPrice: 599, stock: 60 }],
    },
    {
      name: 'Tyre Shine Spray 500ml', slug: 'tyre-shine-spray-500ml', categorySlug: 'car-care',
      variations: [{ name: 'Standard', sku: 'TS-001', price: 249, discountPrice: null, stock: 45 }],
    },
    {
      name: 'Air Freshener Pack (3)', slug: 'air-freshener-pack-3', categorySlug: 'accessories',
      variations: [{ name: 'Standard', sku: 'AF-001', price: 199, discountPrice: 149, stock: 80 }],
    },
  ];

  const productMap = {};
  let variationCount = 0;
  for (const prod of products) {
    const record = await prisma.product.upsert({
      where:  { slug: prod.slug },
      update: { name: prod.name, categoryId: catMap[prod.categorySlug], isActive: true },
      create: {
        name:       prod.name,
        slug:       prod.slug,
        categoryId: catMap[prod.categorySlug],
        isActive:   true,
      },
    });
    productMap[prod.slug] = record.id;

    // Reset variations to match the seed definition (idempotent).
    await prisma.productVariation.deleteMany({ where: { productId: record.id } });
    await prisma.productVariation.createMany({
      data: prod.variations.map((v) => ({
        productId:     record.id,
        name:          v.name,
        sku:           v.sku,
        price:         v.price,
        discountPrice: v.discountPrice,
        stock:         v.stock,
      })),
    });
    variationCount += prod.variations.length;
  }
  console.log(`✅ ${products.length} products seeded`);
  console.log(`✅ ${variationCount} product variations seeded`);

  // ── Slot Config ────────────────────────────────────────────
  const existingSlot = await prisma.slotConfig.findFirst();
  if (!existingSlot) {
    await prisma.slotConfig.create({
      data: { workStartTime: '09:00', workEndTime: '20:00', employeeTeams: 4, slotIntervalMins: 30 },
    });
  }
  console.log('✅ SlotConfig seeded');

  // ── Blocked Dates ──────────────────────────────────────────
  const blockedDates = [
    { date: new Date('2026-08-15'), reason: 'Independence Day – closed' },
    { date: new Date('2026-10-02'), reason: 'Gandhi Jayanti – closed'  },
    { date: new Date('2026-11-01'), reason: 'Diwali – closed'          },
  ];

  for (const bd of blockedDates) {
    await prisma.blockedDate.upsert({
      where:  { date: bd.date },
      update: { reason: bd.reason },
      create: bd,
    });
  }
  console.log(`✅ ${blockedDates.length} blocked dates seeded`);

  // ── Coupons ────────────────────────────────────────────────
  const coupons = [
    { code: 'WELCOME10', type: 'PERCENT', value: 10, maxDiscount: 100,  minOrderAmount: 299,  usageLimit: 100, validFrom: new Date('2026-01-01'), validTo: new Date('2026-12-31') },
    { code: 'FLAT50',    type: 'FLAT',    value: 50, maxDiscount: null,  minOrderAmount: 500,  usageLimit: 200, validFrom: new Date('2026-01-01'), validTo: new Date('2026-12-31') },
    { code: 'WASH20',    type: 'PERCENT', value: 20, maxDiscount: 200,  minOrderAmount: 699,  usageLimit: 50,  validFrom: new Date('2026-04-01'), validTo: new Date('2026-06-30') },
    { code: 'DETAIL500', type: 'FLAT',    value: 500, maxDiscount: null, minOrderAmount: 1499, usageLimit: 30,  validFrom: new Date('2026-01-01'), validTo: new Date('2026-12-31') },
  ];

  const couponMap = {};
  for (const cp of coupons) {
    const record = await prisma.coupon.upsert({
      where:  { code: cp.code },
      update: { value: cp.value, validTo: cp.validTo },
      create: { ...cp, isActive: true },
    });
    couponMap[cp.code] = record.id;
  }
  console.log(`✅ ${coupons.length} coupons seeded`);

  // ── Users (Customers) ──────────────────────────────────────
  const users = [
    { name: 'Rahul Sharma',   email: 'rahul.sharma@gmail.com',  phone: '9876543210' },
    { name: 'Priya Singh',    email: 'priya.singh@gmail.com',   phone: '9876543211' },
    { name: 'Amit Verma',     email: 'amit.verma@yahoo.com',    phone: '9876543212' },
    { name: 'Sneha Patel',    email: 'sneha.patel@gmail.com',   phone: '9876543213' },
    { name: 'Rajesh Kumar',   email: null,                       phone: '9876543214' },
    { name: 'Meera Nair',     email: 'meera.nair@gmail.com',    phone: '9876543215' },
    { name: 'Karan Malhotra', email: 'karan.m@outlook.com',     phone: '9876543216' },
    { name: 'Ananya Rao',     email: 'ananya.rao@gmail.com',    phone: '9876543217' },
  ];

  const userMap = {};
  for (const u of users) {
    const record = await prisma.user.upsert({
      where:  { phone: u.phone },
      update: { name: u.name, email: u.email },
      create: { name: u.name, email: u.email, phone: u.phone, isActive: true },
    });
    userMap[u.phone] = record.id;
  }
  console.log(`✅ ${users.length} users seeded`);

  const userIds  = Object.values(userMap);
  const svcIds   = Object.values(serviceMap);
  const prodIds  = Object.values(productMap);

  // ── Bookings ───────────────────────────────────────────────
  const bookingStatuses = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
  const bookingSeed = [
    { userId: userIds[0], serviceId: svcIds[0], status: 'COMPLETED',   scheduledAt: new Date('2026-04-10T10:00:00'), totalAmount: 299 },
    { userId: userIds[1], serviceId: svcIds[1], status: 'COMPLETED',   scheduledAt: new Date('2026-04-12T11:30:00'), totalAmount: 499 },
    { userId: userIds[2], serviceId: svcIds[4], status: 'CONFIRMED',   scheduledAt: new Date('2026-05-03T09:00:00'), totalAmount: 1499 },
    { userId: userIds[3], serviceId: svcIds[2], status: 'IN_PROGRESS', scheduledAt: new Date('2026-05-01T14:00:00'), totalAmount: 399 },
    { userId: userIds[4], serviceId: svcIds[5], status: 'PENDING',     scheduledAt: new Date('2026-05-05T10:00:00'), totalAmount: 2499 },
    { userId: userIds[5], serviceId: svcIds[7], status: 'CANCELLED',   scheduledAt: new Date('2026-04-20T16:00:00'), totalAmount: 699, notes: 'Customer cancelled' },
    { userId: userIds[6], serviceId: svcIds[3], status: 'CONFIRMED',   scheduledAt: new Date('2026-05-06T13:00:00'), totalAmount: 799 },
    { userId: userIds[7], serviceId: svcIds[0], status: 'COMPLETED',   scheduledAt: new Date('2026-04-25T09:30:00'), totalAmount: 299 },
    { userId: userIds[0], serviceId: svcIds[6], status: 'COMPLETED',   scheduledAt: new Date('2026-04-28T11:00:00'), totalAmount: 599 },
    { userId: userIds[1], serviceId: svcIds[4], status: 'PENDING',     scheduledAt: new Date('2026-05-08T10:00:00'), totalAmount: 1499 },
  ];

  const bookingIds = [];
  for (const b of bookingSeed) {
    const record = await prisma.booking.create({ data: b });
    bookingIds.push(record.id);
  }
  console.log(`✅ ${bookingSeed.length} bookings seeded`);

  // ── Orders ─────────────────────────────────────────────────
  const orderSeed = [
    {
      userId: userIds[0], status: 'DELIVERED', totalAmount: 798,
      items: [{ productId: prodIds[0], quantity: 2, unitPrice: 299 }, { productId: prodIds[1], quantity: 1, unitPrice: 499 }],
    },
    {
      userId: userIds[1], status: 'CONFIRMED', totalAmount: 1298,
      items: [{ productId: prodIds[4], quantity: 1, unitPrice: 1299 }],
    },
    {
      userId: userIds[2], status: 'PENDING', totalAmount: 448,
      items: [{ productId: prodIds[2], quantity: 1, unitPrice: 349 }, { productId: prodIds[7], quantity: 1, unitPrice: 199 }],
    },
    {
      userId: userIds[3], status: 'SHIPPED', totalAmount: 1398,
      items: [{ productId: prodIds[3], quantity: 1, unitPrice: 799 }, { productId: prodIds[5], quantity: 1, unitPrice: 699 }],
    },
    {
      userId: userIds[4], status: 'CANCELLED', totalAmount: 249,
      items: [{ productId: prodIds[6], quantity: 1, unitPrice: 249 }],
    },
    {
      userId: userIds[5], status: 'DELIVERED', totalAmount: 597,
      items: [{ productId: prodIds[0], quantity: 1, unitPrice: 299 }, { productId: prodIds[7], quantity: 1, unitPrice: 199 }, { productId: prodIds[6], quantity: 1, unitPrice: 249 }],
    },
  ];

  const orderIds = [];
  for (const o of orderSeed) {
    const { items, ...orderData } = o;
    const record = await prisma.order.create({
      data: { ...orderData, items: { create: items } },
    });
    orderIds.push(record.id);
  }
  console.log(`✅ ${orderSeed.length} orders seeded`);

  // ── Payments ───────────────────────────────────────────────
  const now = new Date();
  const paymentsSeed = [
    // Booking payments (COMPLETED bookings)
    {
      entityType: 'BOOKING', entityId: bookingIds[0], userId: userIds[0],
      status: 'CAPTURED', amount: 299, grossAmount: 299, method: 'UPI',
      razorpayOrderId: 'order_dummy_001', razorpayPaymentId: 'pay_dummy_001',
      capturedAt: new Date('2026-04-10T10:35:00'),
    },
    {
      entityType: 'BOOKING', entityId: bookingIds[1], userId: userIds[1],
      status: 'CAPTURED', amount: 499, grossAmount: 499, method: 'CARD',
      razorpayOrderId: 'order_dummy_002', razorpayPaymentId: 'pay_dummy_002',
      capturedAt: new Date('2026-04-12T12:00:00'),
    },
    {
      entityType: 'BOOKING', entityId: bookingIds[7], userId: userIds[7],
      status: 'CAPTURED', amount: 299, grossAmount: 299, method: 'UPI',
      razorpayOrderId: 'order_dummy_003', razorpayPaymentId: 'pay_dummy_003',
      capturedAt: new Date('2026-04-25T10:00:00'),
    },
    {
      entityType: 'BOOKING', entityId: bookingIds[8], userId: userIds[0],
      status: 'CAPTURED', amount: 539, grossAmount: 599, method: 'NETBANKING',
      couponId: couponMap['FLAT50'], couponCode: 'FLAT50', discountAmount: 60,
      razorpayOrderId: 'order_dummy_004', razorpayPaymentId: 'pay_dummy_004',
      capturedAt: new Date('2026-04-28T11:20:00'),
    },
    // Order payments
    {
      entityType: 'ORDER', entityId: orderIds[0], userId: userIds[0],
      status: 'CAPTURED', amount: 798, grossAmount: 798, method: 'UPI',
      razorpayOrderId: 'order_dummy_005', razorpayPaymentId: 'pay_dummy_005',
      capturedAt: new Date('2026-04-15T14:00:00'),
    },
    {
      entityType: 'ORDER', entityId: orderIds[3], userId: userIds[3],
      status: 'CAPTURED', amount: 1398, grossAmount: 1398, method: 'CARD',
      razorpayOrderId: 'order_dummy_006', razorpayPaymentId: 'pay_dummy_006',
      capturedAt: new Date('2026-04-18T16:30:00'),
    },
    {
      entityType: 'ORDER', entityId: orderIds[5], userId: userIds[5],
      status: 'CAPTURED', amount: 537, grossAmount: 597, method: 'WALLET',
      couponId: couponMap['WELCOME10'], couponCode: 'WELCOME10', discountAmount: 60,
      razorpayOrderId: 'order_dummy_007', razorpayPaymentId: 'pay_dummy_007',
      capturedAt: new Date('2026-04-22T09:45:00'),
    },
    // Pending / failed
    {
      entityType: 'BOOKING', entityId: bookingIds[4], userId: userIds[4],
      status: 'CREATED', amount: 2499, grossAmount: 2499, method: null,
      razorpayOrderId: 'order_dummy_008',
    },
    {
      entityType: 'ORDER', entityId: orderIds[2], userId: userIds[2],
      status: 'FAILED', amount: 448, grossAmount: 448, method: 'UPI',
      razorpayOrderId: 'order_dummy_009', failureReason: 'Insufficient balance',
    },
    {
      entityType: 'ORDER', entityId: orderIds[1], userId: userIds[1],
      status: 'COD_PENDING', amount: 1298, grossAmount: 1298, method: 'COD',
    },
  ];

  const paymentIds = [];
  for (const p of paymentsSeed) {
    const record = await prisma.payment.create({ data: p });
    paymentIds.push(record.id);
  }
  console.log(`✅ ${paymentsSeed.length} payments seeded`);

  // ── Payment Logs ───────────────────────────────────────────
  const logsSeed = [
    { paymentId: paymentIds[0], fromStatus: null,      toStatus: 'CREATED',    trigger: 'order.created' },
    { paymentId: paymentIds[0], fromStatus: 'CREATED', toStatus: 'AUTHORIZED', trigger: 'payment.authorized' },
    { paymentId: paymentIds[0], fromStatus: 'AUTHORIZED', toStatus: 'CAPTURED', trigger: 'payment.captured' },
    { paymentId: paymentIds[8], fromStatus: null,      toStatus: 'CREATED',    trigger: 'order.created' },
    { paymentId: paymentIds[8], fromStatus: 'CREATED', toStatus: 'FAILED',     trigger: 'payment.failed', metadata: { reason: 'Insufficient balance' } },
  ];

  for (const log of logsSeed) {
    await prisma.paymentLog.create({ data: log });
  }
  console.log(`✅ ${logsSeed.length} payment logs seeded`);

  // ── Invoices ───────────────────────────────────────────────
  // Only for CAPTURED payments
  const capturedPayments = [
    { paymentIdx: 0, entityType: 'BOOKING', entityId: bookingIds[0], userId: userIds[0], subtotal: 299,  discount: 0,  tax: 0,  total: 299,  items: [{ name: 'Basic Exterior Wash', qty: 1, unitPrice: 299 }] },
    { paymentIdx: 1, entityType: 'BOOKING', entityId: bookingIds[1], userId: userIds[1], subtotal: 499,  discount: 0,  tax: 0,  total: 499,  items: [{ name: 'Premium Exterior Wash', qty: 1, unitPrice: 499 }] },
    { paymentIdx: 2, entityType: 'BOOKING', entityId: bookingIds[7], userId: userIds[7], subtotal: 299,  discount: 0,  tax: 0,  total: 299,  items: [{ name: 'Basic Exterior Wash', qty: 1, unitPrice: 299 }] },
    { paymentIdx: 3, entityType: 'BOOKING', entityId: bookingIds[8], userId: userIds[0], subtotal: 599,  discount: 60, tax: 0,  total: 539,  items: [{ name: 'Engine Bay Clean', qty: 1, unitPrice: 599 }] },
    { paymentIdx: 4, entityType: 'ORDER',   entityId: orderIds[0],   userId: userIds[0], subtotal: 798,  discount: 0,  tax: 0,  total: 798,  items: [{ name: 'Car Shampoo 1L', qty: 2, unitPrice: 299 }, { name: 'Microfiber Towel Set', qty: 1, unitPrice: 499 }] },
    { paymentIdx: 5, entityType: 'ORDER',   entityId: orderIds[3],   userId: userIds[3], subtotal: 1398, discount: 0,  tax: 0,  total: 1398, items: [{ name: 'Car Wax Paste 500g', qty: 1, unitPrice: 799 }, { name: 'Anti-Dust Floor Mats', qty: 1, unitPrice: 699 }] },
    { paymentIdx: 6, entityType: 'ORDER',   entityId: orderIds[5],   userId: userIds[5], subtotal: 597,  discount: 60, tax: 0,  total: 537,  items: [{ name: 'Car Shampoo 1L', qty: 1, unitPrice: 299 }, { name: 'Air Freshener Pack (3)', qty: 1, unitPrice: 199 }, { name: 'Tyre Shine Spray 500ml', qty: 1, unitPrice: 249 }] },
  ];

  let invoiceSeq = 0;
  for (const inv of capturedPayments) {
    invoiceSeq++;
    const invoiceNumber = `INV-2026-${String(invoiceSeq).padStart(4, '0')}`;
    await prisma.invoice.create({
      data: {
        paymentId:         paymentIds[inv.paymentIdx],
        invoiceNumber,
        entityType:        inv.entityType,
        entityId:          inv.entityId,
        userId:            inv.userId,
        lineItemsSnapshot: inv.items,
        subtotal:          inv.subtotal,
        discountAmount:    inv.discount,
        taxAmount:         inv.tax,
        totalAmount:       inv.total,
        couponCode:        inv.discount > 0 ? (inv.paymentIdx === 3 ? 'FLAT50' : 'WELCOME10') : null,
      },
    });
  }
  await prisma.invoiceCounter.update({ where: { id: 1 }, data: { lastSeq: invoiceSeq } });
  console.log(`✅ ${capturedPayments.length} invoices seeded`);

  // ── Refunds ────────────────────────────────────────────────
  await prisma.refund.create({
    data: {
      paymentId:       paymentIds[1],
      razorpayRefundId: 'rfnd_dummy_001',
      amount:          499,
      status:          'PROCESSED',
      reason:          'Service not delivered as expected',
      initiatedBy:     admin.id,
      processedAt:     new Date('2026-04-14T10:00:00'),
    },
  });
  console.log('✅ 1 refund seeded');

  // ── Coupon Usages ──────────────────────────────────────────
  const couponUsages = [
    { couponId: couponMap['FLAT50'],    userPhone: '9876543210' },
    { couponId: couponMap['WELCOME10'], userPhone: '9876543215' },
    { couponId: couponMap['WELCOME10'], userPhone: '9876543211' },
    { couponId: couponMap['WASH20'],    userPhone: '9876543212' },
  ];

  for (const cu of couponUsages) {
    await prisma.couponUsage.upsert({
      where:  { couponId_userPhone: { couponId: cu.couponId, userPhone: cu.userPhone } },
      update: {},
      create: cu,
    });
  }
  console.log(`✅ ${couponUsages.length} coupon usages seeded`);

  // ── Webhook Events ─────────────────────────────────────────
  const webhooks = [
    { eventId: 'evt_001', eventType: 'payment.captured',   payload: { paymentId: 'pay_dummy_001', amount: 29900 }, status: 'PROCESSED', processedAt: new Date('2026-04-10T10:36:00') },
    { eventId: 'evt_002', eventType: 'payment.captured',   payload: { paymentId: 'pay_dummy_002', amount: 49900 }, status: 'PROCESSED', processedAt: new Date('2026-04-12T12:01:00') },
    { eventId: 'evt_003', eventType: 'payment.failed',     payload: { paymentId: 'pay_dummy_009', reason: 'Insufficient balance' }, status: 'PROCESSED', processedAt: new Date('2026-04-20T15:00:00') },
    { eventId: 'evt_004', eventType: 'refund.processed',   payload: { refundId: 'rfnd_dummy_001', amount: 49900 }, status: 'PROCESSED', processedAt: new Date('2026-04-14T10:01:00') },
    { eventId: 'evt_005', eventType: 'payment.authorized', payload: { paymentId: 'pay_dummy_008' }, status: 'RECEIVED' },
  ];

  for (const wh of webhooks) {
    await prisma.webhookEvent.upsert({
      where:  { eventId: wh.eventId },
      update: {},
      create: wh,
    });
  }
  console.log(`✅ ${webhooks.length} webhook events seeded`);

  console.log('\n🎉 All dummy data seeded successfully!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
