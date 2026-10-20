const { z } = require('zod');

const createBookingSchema = z.object({
  userId: z.string().min(1),
  serviceId: z.string().min(1),
  scheduledAt: z.string().datetime(),
  notes: z.string().optional(),
  totalAmount: z.number().positive(),
  vehicleTypeId: z.string().optional(),
  carModelId: z.string().optional(),
  fuelType: z.string().optional(),
  plateNumber: z.string().optional()
    .refine((v) => !v || /^[A-Z0-9]{4,}$/i.test(v), 'Plate number must be letters and numbers only, no spaces or special characters'),
  // Admin manual entry only: CASH/CARD = payment already collected in person;
  // PAYMENT_LINK = a Razorpay payment link is generated and sent to the customer.
  paymentMethod: z.enum(['CASH', 'CARD', 'PAYMENT_LINK']).optional(),
});

const updateBookingSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  scheduledAt: z.string().datetime().optional(),
  notes: z.string().optional(),
  beforeImages: z.array(z.string()).max(10).optional(),
  afterImages: z.array(z.string()).max(10).optional(),
});

const listBookingsQuerySchema = z.object({
  userId: z.string().max(50).optional(),
  status: z.enum(['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  search: z.string().max(100).optional(),
  sortBy: z.enum(['createdAt', 'scheduledAt']).default('scheduledAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

module.exports = { createBookingSchema, updateBookingSchema, listBookingsQuerySchema };
