const ordersService = require('./orders.service');
const { createOrderSchema, updateOrderSchema, listOrdersQuerySchema } = require('./orders.schema');

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

module.exports = { getAll, getById, create, update, remove };
