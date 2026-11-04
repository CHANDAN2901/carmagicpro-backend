const { z } = require('zod');
const invoicesService = require('./invoices.service');
const { sendInvoicePdf } = require('../../utils/invoicePdf');

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

const downloadPdf = async (req, res, next) => {
  try {
    const [invoice, gstSettings] = await Promise.all([
      invoicesService.getById(req.params.id),
      invoicesService.getGstSettings(),
    ]);
    sendInvoicePdf(res, invoice, gstSettings);
  } catch (err) { next(err); }
};

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const gstSettingsSchema = z.object({
  gstin: z.string().trim().toUpperCase().refine((v) => !v || GSTIN_RE.test(v), 'Enter a valid 15-character GSTIN'),
  legalName: z.string().trim().max(150),
  address: z.string().trim().max(300),
  state: z.string().trim().max(60),
  sacCode: z.string().trim().regex(/^(\d{4,8})?$/, 'SAC code must be 4–8 digits'),
  rate: z.number().min(0).max(28),
}).refine((d) => !d.gstin || (d.legalName && d.address && d.state), {
  message: 'Legal name, address and state are required when a GSTIN is set',
  path: ['legalName'],
});

const getGstSettings = async (req, res, next) => {
  try {
    res.json({ success: true, data: await invoicesService.getGstSettings() });
  } catch (err) { next(err); }
};

const updateGstSettings = async (req, res, next) => {
  try {
    const data = gstSettingsSchema.parse(req.body);
    res.json({ success: true, data: await invoicesService.saveGstSettings(data) });
  } catch (err) { next(err); }
};

module.exports = { getAll, getById, downloadPdf, getGstSettings, updateGstSettings };
