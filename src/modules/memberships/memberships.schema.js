const { z } = require('zod');
const { FIXED_WASHES } = require('./memberships.pricing');

// The customer picks a plan; price/name/washes are resolved server-side.
//   FIXED  — one tier × 12 or 24 washes/year
//   CUSTOM — a mix of tiers (12–24 washes total, checked in memberships.pricing)
const planSchema = z.discriminatedUnion('planType', [
  z.object({
    planType: z.literal('FIXED'),
    tierId: z.string().min(1),
    washes: z.coerce.number().int().refine((w) => FIXED_WASHES.includes(w), 'Invalid plan'),
  }),
  z.object({
    planType: z.literal('CUSTOM'),
    items: z.array(z.object({ tierId: z.string().min(1), count: z.coerce.number().int().min(0).max(24) })).min(1).max(20),
  }),
]);

// Vehicle details are mandatory (plate number optional), same rule as bookings.
const createMembershipSchema = z.intersection(planSchema, z.object({
  vehicleTypeId: z.string().min(1, 'Please select a vehicle type'),
  carModelId: z.string().optional(),
  fuelType: z.string().optional(),
  plateNumber: z
    .string()
    .optional()
    .refine((v) => !v || /^[A-Z0-9 -]{4,}$/i.test(v), 'Invalid plate number format'),
  address: z.string().min(10, 'Please enter a complete address'),
}));

// Admin: manual entry for a membership paid in person (cash/card swipe).
const createMembershipAdminSchema = z.intersection(planSchema, z.object({
  userId: z.string().min(1),
  vehicleTypeId: z.string().optional(),
  carModelId: z.string().optional(),
  fuelType: z.string().optional(),
  plateNumber: z.string().optional(),
  address: z.string().optional(),
  paymentMethod: z.enum(['CASH', 'CARD']),
  couponCode: z.string().trim().min(1).optional(),
}));

const plansQuerySchema = z.object({ vehicleTypeId: z.string().max(50).optional() });

const listMembershipsQuerySchema = z.object({
  userId: z.string().max(50).optional(),
  status: z.enum(['PENDING', 'ACTIVE', 'CANCELLED']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

module.exports = { createMembershipSchema, createMembershipAdminSchema, plansQuerySchema, listMembershipsQuerySchema };
