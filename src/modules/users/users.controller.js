const usersService = require('./users.service');
const { createUserSchema, updateUserSchema, listUsersQuerySchema } = require('./users.schema');
const { parseDateRange, buildWorkbook, sendWorkbook } = require('../../utils/excel');

// Unique phone/email collision → readable 409 instead of a 500.
const sendConflict = (err, res) => {
  if (err?.code !== 'P2002') return false;
  const target = Array.isArray(err.meta?.target) ? err.meta.target.join(',') : String(err.meta?.target ?? '');
  const label = target.includes('email') ? 'Email' : target.includes('phone') ? 'Phone number' : 'Value';
  res.status(409).json({ success: false, message: `${label} is already in use by another account` });
  return true;
};

const exportExcel = async (req, res, next) => {
  try {
    const range = parseDateRange(req.query);
    const users = await usersService.getForExport(range);
    const columns = [
      { header: 'Name', key: 'name', width: 22 },
      { header: 'Phone', key: 'phone', width: 16 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'Address', key: 'address', width: 40 },
      { header: 'Type', key: 'type', width: 10 },
      { header: 'Bookings', key: 'bookingCount', width: 10 },
      { header: 'Verified', key: 'verified', width: 10 },
      { header: 'Active', key: 'active', width: 10 },
      { header: 'Joined', key: 'createdAt', width: 20, style: { numFmt: 'dd-mm-yyyy hh:mm' } },
    ];
    const rows = users.map((u) => ({
      name: u.name ?? '',
      phone: u.phone ?? '',
      email: u.email ?? '',
      address: u.address ?? '',
      type: u.isClient ? 'Client' : 'User',
      bookingCount: u.bookingCount,
      verified: u.isVerified ? 'Yes' : 'No',
      active: u.isActive ? 'Yes' : 'No',
      createdAt: u.createdAt,
    }));
    await sendWorkbook(res, buildWorkbook('Users', columns, rows), `users_${req.query.startDate}_to_${req.query.endDate}.xlsx`);
  } catch (err) {
    next(err);
  }
};

const getAll = async (req, res, next) => {
  try {
    const { page, limit, search, type } = listUsersQuerySchema.parse(req.query);
    const result = await usersService.getAll({ page, limit, search, type });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const user = await usersService.getDetail(req.params.id);
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
    if (!sendConflict(err, res)) next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const body = updateUserSchema.parse(req.body);
    const user = await usersService.update(req.params.id, body);
    res.json({ success: true, user });
  } catch (err) {
    if (!sendConflict(err, res)) next(err);
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

module.exports = { exportExcel, getAll, getById, create, update, remove, bulkRemove };
