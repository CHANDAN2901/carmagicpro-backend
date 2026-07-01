const { z } = require('zod');
const { PLAN_KEYS } = require('./memberships.plans');

// Customer picks a static plan by key; price/name are resolved server-side.
const createMembershipSchema = z.object({
  planKey: z.enum(PLAN_KEYS),
});

const listMembershipsQuerySchema = z.object({
  userId: z.string().max(50).optional(),
  status: z.enum(['PENDING', 'ACTIVE', 'CANCELLED']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

module.exports = { createMembershipSchema, listMembershipsQuerySchema };
