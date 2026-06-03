const { z } = require('zod');

const createUserSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(10).max(15).optional(),
  email: z.string().email(),
  isActive: z.boolean().optional(),
});

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().min(10).max(15).optional(),
  email: z.string().email().optional(),
  isActive: z.boolean().optional(),
});

const listUsersQuerySchema = z.object({
  search: z.string().max(255).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

module.exports = { createUserSchema, updateUserSchema, listUsersQuerySchema };
