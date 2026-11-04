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

// Business GST details printed on invoices, edited from CRM → GST Settings.
// One JSON row in app_settings; an empty gstin means plain (non-GST) invoices.
const GST_SETTINGS_KEY = 'gst_settings';
const DEFAULT_GST_SETTINGS = { gstin: '', legalName: '', address: '', state: '', sacCode: '', rate: 18 };

// `client` lets createInvoice read it inside its transaction.
const getGstSettings = async (client = prisma) => {
  const row = await client.appSetting.findUnique({ where: { key: GST_SETTINGS_KEY } });
  return { ...DEFAULT_GST_SETTINGS, ...(row ? JSON.parse(row.value) : {}) };
};

const saveGstSettings = async (data) => {
  const value = JSON.stringify(data);
  await prisma.appSetting.upsert({
    where: { key: GST_SETTINGS_KEY },
    update: { value },
    create: { key: GST_SETTINGS_KEY, value },
  });
  return getGstSettings();
};

module.exports = { getAll, getById, getGstSettings, saveGstSettings };
