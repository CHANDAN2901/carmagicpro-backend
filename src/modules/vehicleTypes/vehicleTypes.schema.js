const { z } = require('zod');

const createVehicleTypeSchema = z.object({
  name: z.string().min(1),
});

const updateVehicleTypeSchema = z.object({
  name: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

module.exports = { createVehicleTypeSchema, updateVehicleTypeSchema };
