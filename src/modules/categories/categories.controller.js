const categoriesService = require('./categories.service');
const { createCategorySchema, updateCategorySchema } = require('./categories.schema');

const getAll = async (req, res, next) => {
  try {
    const { type } = req.query;
    const categories = await categoriesService.getAll({ type });
    res.json({ success: true, categories });
  } catch (err) {
    next(err);
  }
};

// Flat list for dropdowns (includes subcategories)
const getAllFlat = async (req, res, next) => {
  try {
    const { type } = req.query;
    const categories = await categoriesService.getAllFlat({ type });
    res.json({ success: true, categories });
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const category = await categoriesService.getById(req.params.id);
    res.json({ success: true, category });
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const body = createCategorySchema.parse(req.body);
    const category = await categoriesService.create(body);
    res.status(201).json({ success: true, category });
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const body = updateCategorySchema.parse(req.body);
    const category = await categoriesService.update(req.params.id, body);
    res.json({ success: true, category });
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    await categoriesService.remove(req.params.id);
    res.json({ success: true, message: 'Category deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, getAllFlat, getById, create, update, remove };
