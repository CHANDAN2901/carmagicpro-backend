const productsService = require('./products.service');
const { createProductSchema, updateProductSchema } = require('./products.schema');

const getAll = async (req, res, next) => {
  try {
    const { categoryId, isActive } = req.query;
    const products = await productsService.getAll({ categoryId, isActive });
    res.json({ success: true, products });
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const product = await productsService.getById(req.params.id);
    res.json({ success: true, product });
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const body = createProductSchema.parse(req.body);
    const product = await productsService.create(body);
    res.status(201).json({ success: true, product });
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const body = updateProductSchema.parse(req.body);
    const product = await productsService.update(req.params.id, body);
    res.json({ success: true, product });
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    await productsService.remove(req.params.id);
    res.json({ success: true, message: 'Product deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, getById, create, update, remove };
