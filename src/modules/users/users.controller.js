const usersService = require('./users.service');
const { createUserSchema, updateUserSchema, listUsersQuerySchema } = require('./users.schema');

const getAll = async (req, res, next) => {
  try {
    const { page, limit, search } = listUsersQuerySchema.parse(req.query);
    const result = await usersService.getAll({ page, limit, search });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const user = await usersService.getById(req.params.id);
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const body = createUserSchema.parse(req.body);
    const user = await usersService.create(body);
    res.status(201).json({ success: true, user });
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const body = updateUserSchema.parse(req.body);
    const user = await usersService.update(req.params.id, body);
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    await usersService.remove(req.params.id);
    res.json({ success: true, message: 'User deleted' });
  } catch (err) {
    next(err);
  }
};

const bulkRemove = async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter(Boolean) : []
    if (!ids.length) return res.status(400).json({ success: false, message: 'No IDs provided' })
    const result = await usersService.bulkRemove(ids)
    res.json({ success: true, ...result })
  } catch (err) {
    next(err)
  }
}

module.exports = { getAll, getById, create, update, remove, bulkRemove };
