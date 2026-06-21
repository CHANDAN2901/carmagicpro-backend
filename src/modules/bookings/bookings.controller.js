const bookingsService = require('./bookings.service');
const { createBookingSchema, updateBookingSchema, listBookingsQuerySchema } = require('./bookings.schema');
const { parseDateRange, buildWorkbook, sendWorkbook } = require('../../utils/excel');

const DATE_FMT = 'dd-mm-yyyy hh:mm';

const exportExcel = async (req, res, next) => {
  try {
    const range = parseDateRange(req.query);
    const bookings = await bookingsService.getForExport(range);

    const columns = [
      { header: 'Booking ID', key: 'bookingNumber', width: 18 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Customer', key: 'customer', width: 22 },
      { header: 'Phone', key: 'phone', width: 16 },
      { header: 'Email', key: 'email', width: 26 },
      { header: 'Service', key: 'service', width: 24 },
      { header: 'Vehicle', key: 'vehicle', width: 24 },
      { header: 'Fuel', key: 'fuel', width: 10 },
      { header: 'Plate Number', key: 'plate', width: 16 },
      { header: 'Scheduled', key: 'scheduledAt', width: 20, style: { numFmt: DATE_FMT } },
      { header: 'Amount (INR)', key: 'amount', width: 14, style: { numFmt: '#,##0.00' } },
      { header: 'Notes', key: 'notes', width: 30 },
      { header: 'Created', key: 'createdAt', width: 20, style: { numFmt: DATE_FMT } },
    ];

    const rows = bookings.map((b) => ({
      bookingNumber: b.bookingNumber ?? b.id,
      status: b.status,
      customer: b.user?.name ?? '',
      phone: b.user?.phone ?? '',
      email: b.user?.email ?? '',
      service: b.service?.name ?? '',
      vehicle: b.carModel
        ? `${b.carModel.brand?.name ?? ''} ${b.carModel.name}`.trim()
        : (b.vehicleType?.name ?? ''),
      fuel: b.fuelType ?? '',
      plate: b.plateNumber ?? '',
      scheduledAt: b.scheduledAt,
      amount: Number(b.totalAmount),
      notes: b.notes ?? '',
      createdAt: b.createdAt,
    }));

    const wb = buildWorkbook('Bookings', columns, rows);
    await sendWorkbook(res, wb, `bookings_${req.query.startDate}_to_${req.query.endDate}.xlsx`);
  } catch (err) {
    next(err);
  }
};

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

module.exports = { getAll, exportExcel, getById, create, update, remove };
