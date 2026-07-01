const membershipsService = require('./memberships.service');
const { createMembershipSchema, listMembershipsQuerySchema } = require('./memberships.schema');
const { PLANS } = require('./memberships.plans');
const { parseDateRange, buildWorkbook, sendWorkbook } = require('../../utils/excel');

const DATE_FMT = 'dd-mm-yyyy hh:mm';

// Public: the static plan catalog the customer site renders / validates against.
const getPlans = async (_req, res) => {
  res.json({ success: true, plans: Object.values(PLANS) });
};

// Customer: create a PENDING membership for the logged-in user.
const createForCustomer = async (req, res, next) => {
  try {
    const { planKey } = createMembershipSchema.parse(req.body);
    const membership = await membershipsService.create({ userId: req.user.userId, planKey });
    res.status(201).json({ success: true, membership });
  } catch (err) { next(err); }
};

// Customer: list my memberships.
const getMine = async (req, res, next) => {
  try {
    const memberships = await membershipsService.getMine(req.user.userId);
    res.json({ success: true, memberships });
  } catch (err) { next(err); }
};

// Admin: list all memberships.
const getAll = async (req, res, next) => {
  try {
    const query = listMembershipsQuerySchema.parse(req.query);
    const result = await membershipsService.getAll(query);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const membership = await membershipsService.getById(req.params.id);
    res.json({ success: true, membership });
  } catch (err) { next(err); }
};

// Admin: Excel export over a date range.
const exportExcel = async (req, res, next) => {
  try {
    const range = parseDateRange(req.query);
    const memberships = await membershipsService.getForExport(range);

    const columns = [
      { header: 'Membership ID', key: 'membershipNumber', width: 18 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Plan', key: 'plan', width: 30 },
      { header: 'Washes/Year', key: 'washes', width: 12, style: { numFmt: '#,##0' } },
      { header: 'Customer', key: 'customer', width: 22 },
      { header: 'Phone', key: 'phone', width: 16 },
      { header: 'Email', key: 'email', width: 26 },
      { header: 'Price (INR)', key: 'price', width: 14, style: { numFmt: '#,##0.00' } },
      { header: 'Start Date', key: 'startDate', width: 20, style: { numFmt: DATE_FMT } },
      { header: 'Expires', key: 'expiresAt', width: 20, style: { numFmt: DATE_FMT } },
      { header: 'Created', key: 'createdAt', width: 20, style: { numFmt: DATE_FMT } },
    ];

    const rows = memberships.map((m) => ({
      membershipNumber: m.membershipNumber ?? m.id,
      status: m.status,
      plan: m.planName,
      washes: m.washesPerYear,
      customer: m.user?.name ?? '',
      phone: m.user?.phone ?? '',
      email: m.user?.email ?? '',
      price: Number(m.price),
      startDate: m.startDate ?? null,
      expiresAt: m.expiresAt ?? null,
      createdAt: m.createdAt,
    }));

    const wb = buildWorkbook('Memberships', columns, rows);
    await sendWorkbook(res, wb, `memberships_${req.query.startDate}_to_${req.query.endDate}.xlsx`);
  } catch (err) { next(err); }
};

module.exports = { getPlans, createForCustomer, getMine, getAll, getById, exportExcel };
