const { z } = require('zod');

const categoryTypeEnum = z.enum(['SERVICE', 'PRODUCT', 'BOTH']);

const createCategorySchema = z.object({
  name: z.string().min(1),
  type: categoryTypeEnum.default('BOTH'),
  parentId: z.string().optional(),
  description: z.string().optional(),
  imageUrl: z.string().url().optional(),
  isActive: z.boolean().optional(),
});

const updateCategorySchema = z.object({
  name: z.string().min(1).optional(),
  type: categoryTypeEnum.optional(),
  parentId: z.string().optional().nullable(),
  description: z.string().optional(),
  imageUrl: z.string().url().optional(),
  isActive: z.boolean().optional(),
});

module.exports = { createCategorySchema, updateCategorySchema };
