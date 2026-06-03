const servicesService = require('./services.service');
const { createServiceSchema, updateServiceSchema } = require('./services.schema');

const getAll = async (req, res, next) => {
  try {
    const { categoryId, isActive } = req.query;
    const services = await servicesService.getAll({ categoryId, isActive });
    res.json({ success: true, services });
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const service = await servicesService.getById(req.params.id);
    res.json({ success: true, service });
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const body = createServiceSchema.parse(req.body);
    const service = await servicesService.create(body);
    res.status(201).json({ success: true, service });
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const body = updateServiceSchema.parse(req.body);
    const service = await servicesService.update(req.params.id, body);
    res.json({ success: true, service });
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    await servicesService.remove(req.params.id);
    res.json({ success: true, message: 'Service deleted' });
  } catch (err) {
    next(err);
  }
};

const bulkRemove = async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter(Boolean) : []
    if (!ids.length) return res.status(400).json({ success: false, message: 'No IDs provided' })
    const result = await servicesService.bulkRemove(ids)
    res.json({ success: true, ...result })
  } catch (err) {
    next(err)
  }
}

module.exports = { getAll, getById, create, update, remove, bulkRemove };
