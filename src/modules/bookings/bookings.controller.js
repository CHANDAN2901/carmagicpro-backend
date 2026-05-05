const bookingsService = require('./bookings.service');
const { createBookingSchema, updateBookingSchema, listBookingsQuerySchema } = require('./bookings.schema');

const getAll = async (req, res, next) => {
  try {
    const { userId, status, page, limit } = listBookingsQuerySchema.parse(req.query);
    const result = await bookingsService.getAll({ userId, status, page, limit });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const booking = await bookingsService.getById(req.params.id);
    res.json({ success: true, booking });
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const body = createBookingSchema.parse(req.body);
    const booking = await bookingsService.create(body);
    res.status(201).json({ success: true, booking });
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const body = updateBookingSchema.parse(req.body);
    const booking = await bookingsService.update(req.params.id, body);
    res.json({ success: true, booking });
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    await bookingsService.remove(req.params.id);
    res.json({ success: true, message: 'Booking deleted' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, getById, create, update, remove };
