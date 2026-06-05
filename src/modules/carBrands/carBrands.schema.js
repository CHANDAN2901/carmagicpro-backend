const { z } = require('zod');

const createCarBrandSchema = z.object({
  name: z.string().min(1).max(100),
});

const updateCarBrandSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
});

module.exports = { createCarBrandSchema, updateCarBrandSchema };
