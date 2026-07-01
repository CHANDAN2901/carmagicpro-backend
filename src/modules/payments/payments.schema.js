const { z } = require('zod');

const createOrderSchema = z.object({
  entityType: z.enum(['BOOKING', 'ORDER', 'MEMBERSHIP']),
  entityId: z.string().min(1),
  couponCode: z.string().optional(),
  method: z.enum(['UPI', 'CARD', 'NETBANKING', 'WALLET', 'COD', 'OTHER']).optional(),
  userId: z.string().min(1),
});

const verifySchema = z.object({
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
});

const refundSchema = z.object({
  amount: z.number().positive(),
  reason: z.string().optional(),
});

const listQuerySchema = z.object({
  entityType: z.enum(['BOOKING', 'ORDER', 'MEMBERSHIP']).optional(),
  status: z.string().optional(),
  method: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

module.exports = { createOrderSchema, verifySchema, refundSchema, listQuerySchema };
