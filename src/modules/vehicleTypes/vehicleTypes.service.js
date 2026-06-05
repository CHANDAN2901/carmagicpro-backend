const prisma = require('../../config/prisma');

function toSlug(name) {
  return name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

const getAll = async ({ isActive } = {}) => {
  const where = {};
  if (isActive !== undefined) where.isActive = isActive === 'true' || isActive === true;
  return prisma.vehicleType.findMany({ where, orderBy: { name: 'asc' } });
};

const getById = async (id) => {
  const vt = await prisma.vehicleType.findUnique({ where: { id } });
  if (!vt) throw Object.assign(new Error('Vehicle type not found'), { statusCode: 404 });
  return vt;
};

const create = async (data) => {
  const slug = toSlug(data.name);
  return prisma.vehicleType.create({ data: { ...data, slug } });
};

const update = async (id, data) => {
  await getById(id);
  const updateData = { ...data };
  if (data.name) updateData.slug = toSlug(data.name);
  return prisma.vehicleType.update({ where: { id }, data: updateData });
};

const remove = async (id) => {
  await getById(id);
  const modelCount = await prisma.carModel.count({ where: { vehicleTypeId: id } });
  if (modelCount > 0) {
    throw Object.assign(
      new Error(`Reassign or delete the ${modelCount} car model(s) using this vehicle type first`),
      { statusCode: 409 }
    );
  }
  await prisma.servicePricing.deleteMany({ where: { vehicleTypeId: id } });
  try { await prisma.vehicle.deleteMany({ where: { vehicleTypeId: id } }) } catch (e) {
    if (e?.code !== 'P2021') throw e;
  }
  return prisma.vehicleType.delete({ where: { id } });
};

module.exports = { getAll, getById, create, update, remove };
