const paymentsService = require('./payments.service');
const { createOrderSchema, verifySchema, refundSchema, listQuerySchema } = require('./payments.schema');

const createOrder = async (req, res, next) => {
  try {
    const data = createOrderSchema.parse(req.body);
    const result = await paymentsService.createOrder(data);
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
};

const verifyPayment = async (req, res, next) => {
  try {
    const data = verifySchema.parse(req.body);
    const result = await paymentsService.verifyPayment(data);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

const getAll = async (req, res, next) => {
  try {
    const query = listQuerySchema.parse(req.query);
    const result = await paymentsService.getAll(query);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const result = await paymentsService.getById(req.params.id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

const getByEntity = async (req, res, next) => {
  try {
    const { entityType, entityId } = req.params;
    const result = await paymentsService.getByEntity(entityType, entityId);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

const codCollect = async (req, res, next) => {
  try {
    const result = await paymentsService.codCollect(req.params.id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

const initiateRefund = async (req, res, next) => {
  try {
    const data = refundSchema.parse(req.body);
    const result = await paymentsService.initiateRefund(req.params.id, data);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

module.exports = { createOrder, verifyPayment, getAll, getById, getByEntity, codCollect, initiateRefund };
