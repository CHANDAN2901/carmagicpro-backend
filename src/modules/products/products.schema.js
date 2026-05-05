const { z } = require('zod');

const variationSchema = z.object({
  name: z.string().min(1),
  sku: z.string().optional(),
  price: z.number().min(0),
  stock: z.number().int().min(0).default(0),
});

const imagesSchema = z.array(z.string().url()).max(10).optional().default([]);

const createProductSchema = z.object({
  categoryId: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().positive(),
  discountPrice: z.number().min(0).optional(),
  sku: z.string().optional(),
  stock: z.number().int().min(0).default(0),
  images: imagesSchema,
  variations: z.array(variationSchema).optional().default([]),
});

const updateProductSchema = z.object({
  categoryId: z.string().optional().nullable(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  price: z.number().positive().optional(),
  discountPrice: z.number().min(0).optional().nullable(),
  sku: z.string().optional(),
  stock: z.number().int().min(0).optional(),
  images: imagesSchema,
  isActive: z.boolean().optional(),
  variations: z.array(variationSchema).optional(),
});

module.exports = { createProductSchema, updateProductSchema };
