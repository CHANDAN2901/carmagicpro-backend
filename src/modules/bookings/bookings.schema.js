const { z } = require('zod');

const createBookingSchema = z.object({
  userId: z.string().min(1),
  serviceId: z.string().min(1),
  scheduledAt: z.string().datetime(),
  notes: z.string().optional(),
  totalAmount: z.number().positive(),
});

const updateBookingSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  scheduledAt: z.string().datetime().optional(),
  notes: z.string().optional(),
});

const listBookingsQuerySchema = z.object({
  userId: z.string().max(50).optional(),
  status: z.enum(['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

module.exports = { createBookingSchema, updateBookingSchema, listBookingsQuerySchema };
