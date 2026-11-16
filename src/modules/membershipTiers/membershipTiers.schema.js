const { z } = require('zod');

const money = z.coerce.number().positive().max(1000000);

const tierFields = {
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(300).optional().nullable(),
  features: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  defaultMrp: money,
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).max(1000).optional(),
  // Per-car-type MRP overrides; replaces the whole set when sent.
  prices: z.array(z.object({ vehicleTypeId: z.string().min(1), mrp: money })).max(50).optional(),
};

const createTierSchema = z.object(tierFields);
const updateTierSchema = z.object(tierFields).partial();

const pct = z.coerce.number().min(0).max(90);
const discountsSchema = z.object({ 12: pct, 24: pct, custom: pct });

module.exports = { createTierSchema, updateTierSchema, discountsSchema };
