const vehicleTypesService = require('./vehicleTypes.service');
const { createVehicleTypeSchema, updateVehicleTypeSchema } = require('./vehicleTypes.schema');

const getAll = async (req, res, next) => {
  try {
    const { isActive } = req.query;
    const vehicleTypes = await vehicleTypesService.getAll({ isActive });
    res.json({ success: true, vehicleTypes });
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const vehicleType = await vehicleTypesService.getById(req.params.id);
    res.json({ success: true, vehicleType });
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const body = createVehicleTypeSchema.parse(req.body);
    const vehicleType = await vehicleTypesService.create(body);
    res.status(201).json({ success: true, vehicleType });
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const body = updateVehicleTypeSchema.parse(req.body);
    const vehicleType = await vehicleTypesService.update(req.params.id, body);
    res.json({ success: true, vehicleType });
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    await vehicleTypesService.remove(req.params.id);
    res.json({ success: true, message: 'Vehicle type deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, getById, create, update, remove };
