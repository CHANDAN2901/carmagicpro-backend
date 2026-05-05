const { z } = require('zod');
const invoicesService = require('./invoices.service');

const listQuerySchema = z.object({
  entityType: z.enum(['BOOKING', 'ORDER']).optional(),
  userId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const getAll = async (req, res, next) => {
  try {
    const query = listQuerySchema.parse(req.query);
    const result = await invoicesService.getAll(query);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const result = await invoicesService.getById(req.params.id);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

module.exports = { getAll, getById };
