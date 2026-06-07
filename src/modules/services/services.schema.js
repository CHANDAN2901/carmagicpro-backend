const { z } = require('zod');

const pricingSchema = z.object({
  vehicleTypeId: z.string().min(1),
  price: z.number().positive(),
});

const imagesSchema = z.array(z.string().url()).max(10).optional().default([]);

const createServiceSchema = z.object({
  categoryId: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().positive(),
  durationMins: z.number().int().positive(),
  images: imagesSchema,
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  pricings: z.array(pricingSchema).optional(),
});

const updateServiceSchema = z.object({
  categoryId: z.string().optional().nullable(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  price: z.number().positive().optional(),
  durationMins: z.number().int().positive().optional(),
  images: imagesSchema,
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  pricings: z.array(pricingSchema).optional(),
});

module.exports = { createServiceSchema, updateServiceSchema };
