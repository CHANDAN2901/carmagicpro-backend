const { z } = require('zod');
const { PLAN_KEYS } = require('./memberships.plans');

// Customer picks a static plan by key; price/name are resolved server-side.
// Vehicle details are mandatory (plate number optional), same rule as bookings.
const createMembershipSchema = z.object({
  planKey: z.enum(PLAN_KEYS),
  vehicleTypeId: z.string().min(1, 'Please select a vehicle type'),
  carModelId: z.string().optional(),
  fuelType: z.string().optional(),
  plateNumber: z
    .string()
    .optional()
    .refine((v) => !v || /^[A-Z0-9 -]{4,}$/i.test(v), 'Invalid plate number format'),
  address: z.string().min(10, 'Please enter a complete address'),
});

// Admin: manual entry for a membership paid in person (cash/card swipe).
const createMembershipAdminSchema = z.object({
  userId: z.string().min(1),
  planKey: z.enum(PLAN_KEYS),
  vehicleTypeId: z.string().optional(),
  carModelId: z.string().optional(),
  fuelType: z.string().optional(),
  plateNumber: z.string().optional(),
  address: z.string().optional(),
  paymentMethod: z.enum(['CASH', 'CARD']),
});

const listMembershipsQuerySchema = z.object({
  userId: z.string().max(50).optional(),
  status: z.enum(['PENDING', 'ACTIVE', 'CANCELLED']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

module.exports = { createMembershipSchema, createMembershipAdminSchema, listMembershipsQuerySchema };
