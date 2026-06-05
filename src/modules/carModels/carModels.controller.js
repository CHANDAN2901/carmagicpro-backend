const service = require('./carModels.service');
const { createCarModelSchema, updateCarModelSchema } = require('./carModels.schema');

const getAll = async (req, res, next) => {
  try {
    const { brandId, vehicleTypeId, isActive } = req.query;
    const carModels = await service.getAll({ brandId, vehicleTypeId, isActive });
    res.json({ success: true, carModels });
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const carModel = await service.getById(req.params.id);
    res.json({ success: true, carModel });
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const body = createCarModelSchema.parse(req.body);
    const carModel = await service.create(body);
    res.status(201).json({ success: true, carModel });
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const body = updateCarModelSchema.parse(req.body);
    const carModel = await service.update(req.params.id, body);
    res.json({ success: true, carModel });
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    await service.remove(req.params.id);
    res.json({ success: true, message: 'Car model deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, getById, create, update, remove };
