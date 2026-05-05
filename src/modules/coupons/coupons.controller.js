const couponsService = require('./coupons.service');
const { createCouponSchema, updateCouponSchema, applyCouponSchema } = require('./coupons.schema');

const getAll = async (req, res, next) => {
  try {
    const coupons = await couponsService.getAll();
    res.json({ success: true, coupons });
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const coupon = await couponsService.getById(req.params.id);
    res.json({ success: true, coupon });
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const body = createCouponSchema.parse(req.body);
    const coupon = await couponsService.create(body);
    res.status(201).json({ success: true, coupon });
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const body = updateCouponSchema.parse(req.body);
    const coupon = await couponsService.update(req.params.id, body);
    res.json({ success: true, coupon });
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    await couponsService.remove(req.params.id);
    res.json({ success: true, message: 'Coupon deleted' });
  } catch (err) {
    next(err);
  }
};

const apply = async (req, res, next) => {
  try {
    const body = applyCouponSchema.parse(req.body);
    const result = await couponsService.apply(body);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, getById, create, update, remove, apply };
