const { z } = require('zod');

// Pricing/stock live on variations. Every product needs at least one variant.
const variationSchema = z.object({
  name: z.string().min(1),
  sku: z.string().optional(),
  price: z.number().positive(),
  discountPrice: z.number().min(0).optional(),
  stock: z.number().int().min(0).default(0),
});

const imagesSchema = z.array(z.string().url()).max(10).optional().default([]);

const createProductSchema = z.object({
  categoryId: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  images: imagesSchema,
  isActive: z.boolean().optional(),
  variations: z.array(variationSchema).min(1, 'At least one variant is required'),
});

const updateProductSchema = z.object({
  categoryId: z.string().optional().nullable(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  images: imagesSchema,
  isActive: z.boolean().optional(),
  variations: z.array(variationSchema).min(1, 'At least one variant is required').optional(),
});

module.exports = { createProductSchema, updateProductSchema };
