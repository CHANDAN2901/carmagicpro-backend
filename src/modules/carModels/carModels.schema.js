const { z } = require('zod');

const fuelTypeEnum = z.enum(['PETROL', 'DIESEL', 'CNG', 'ELECTRIC', 'HYBRID']);

const createCarModelSchema = z.object({
  brandId: z.string().min(1),
  vehicleTypeId: z.string().min(1),
  name: z.string().min(1).max(100),
  fuelTypes: z.array(fuelTypeEnum).min(1, 'At least one fuel type is required'),
});

const updateCarModelSchema = z.object({
  brandId: z.string().min(1).optional(),
  vehicleTypeId: z.string().min(1).optional(),
  name: z.string().min(1).max(100).optional(),
  fuelTypes: z.array(fuelTypeEnum).min(1).optional(),
  isActive: z.boolean().optional(),
});

module.exports = { createCarModelSchema, updateCarModelSchema };
