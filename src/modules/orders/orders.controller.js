const ordersService = require('./orders.service');
const { createOrderSchema, createPublicOrderSchema, updateOrderSchema, listOrdersQuerySchema } = require('./orders.schema');
const { parseDateRange, buildWorkbook, sendWorkbook } = require('../../utils/excel');

const DATE_FMT = 'dd-mm-yyyy hh:mm';

const exportExcel = async (req, res, next) => {
  try {
    const range = parseDateRange(req.query);
    const orders = await ordersService.getForExport(range);

    const columns = [
      { header: 'Order ID', key: 'orderNumber', width: 18 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Customer', key: 'customer', width: 22 },
      { header: 'Phone', key: 'phone', width: 16 },
      { header: 'Email', key: 'email', width: 26 },
      { header: 'Items', key: 'items', width: 40 },
      { header: 'Total Qty', key: 'qty', width: 10, style: { numFmt: '#,##0' } },
      { header: 'Amount (INR)', key: 'amount', width: 14, style: { numFmt: '#,##0.00' } },
      { header: 'Notes', key: 'notes', width: 30 },
      { header: 'Created', key: 'createdAt', width: 20, style: { numFmt: DATE_FMT } },
    ];

    const rows = orders.map((o) => ({
      orderNumber: o.orderNumber ?? o.id,
      status: o.status,
      customer: o.user?.name ?? '',
      phone: o.user?.phone ?? '',
      email: o.user?.email ?? '',
      items: (o.items ?? [])
        .map((i) => `${i.product?.name ?? 'Item'}${i.variation?.name ? ` - ${i.variation.name}` : ''} x${i.quantity}`)
        .join('; '),
      qty: (o.items ?? []).reduce((sum, i) => sum + i.quantity, 0),
      amount: Number(o.totalAmount),
      notes: o.notes ?? '',
      createdAt: o.createdAt,
    }));

    const wb = buildWorkbook('Orders', columns, rows);
    await sendWorkbook(res, wb, `orders_${req.query.startDate}_to_${req.query.endDate}.xlsx`);
  } catch (err) {
    next(err);
  }
};

const getAll = async (req, res, next) => {
  try {
    const { userId, status, page, limit } = listOrdersQuerySchema.parse(req.query);
    const result = await ordersService.getAll({ userId, status, page, limit });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const order = await ordersService.getById(req.params.id);
    res.json({ success: true, order });
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const body = createOrderSchema.parse(req.body);
    const order = await ordersService.create(body);
    res.status(201).json({ success: true, order });
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const body = updateOrderSchema.parse(req.body);
    const order = await ordersService.update(req.params.id, body);
    res.json({ success: true, order });
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    await ordersService.remove(req.params.id);
    res.json({ success: true, message: 'Order deleted' });
  } catch (err) {
    next(err);
  }
};

const createPublic = async (req, res, next) => {
  try {
    const body = createPublicOrderSchema.parse(req.body);
    const order = await ordersService.createPublic(body);
    res.status(201).json({ success: true, order });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, exportExcel, getById, create, createPublic, update, remove };
