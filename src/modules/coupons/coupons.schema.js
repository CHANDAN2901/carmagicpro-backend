const { z } = require('zod');

const createCouponSchema = z.object({
  code: z.string().min(1).toUpperCase(),
  type: z.enum(['FLAT', 'PERCENT']),
  value: z.number().positive(),
  maxDiscount: z.number().positive().optional(),
  minOrderAmount: z.number().positive().optional(),
  usageLimit: z.number().int().positive().optional(),
  validFrom: z.string().min(1),
  validTo: z.string().min(1),
  isActive: z.boolean().optional(),
});

const updateCouponSchema = z.object({
  code: z.string().min(1).optional(),
  type: z.enum(['FLAT', 'PERCENT']).optional(),
  value: z.number().positive().optional(),
  maxDiscount: z.number().positive().optional().nullable(),
  minOrderAmount: z.number().positive().optional().nullable(),
  usageLimit: z.number().int().positive().optional().nullable(),
  validFrom: z.string().min(1).optional(),
  validTo: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

const applyCouponSchema = z.object({
  code: z.string().min(1),
  amount: z.number().positive(),
  userPhone: z.string().min(1),
});

module.exports = { createCouponSchema, updateCouponSchema, applyCouponSchema };
