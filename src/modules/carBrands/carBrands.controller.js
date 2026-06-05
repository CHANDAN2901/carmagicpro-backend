const service = require('./carBrands.service');
const { createCarBrandSchema, updateCarBrandSchema } = require('./carBrands.schema');

const getAll = async (req, res, next) => {
  try {
    const { isActive } = req.query;
    const carBrands = await service.getAll({ isActive });
    res.json({ success: true, carBrands });
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const carBrand = await service.getById(req.params.id);
    res.json({ success: true, carBrand });
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const body = createCarBrandSchema.parse(req.body);
    const carBrand = await service.create(body);
    res.status(201).json({ success: true, carBrand });
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const body = updateCarBrandSchema.parse(req.body);
    const carBrand = await service.update(req.params.id, body);
    res.json({ success: true, carBrand });
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    await service.remove(req.params.id);
    res.json({ success: true, message: 'Car brand deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, getById, create, update, remove };
