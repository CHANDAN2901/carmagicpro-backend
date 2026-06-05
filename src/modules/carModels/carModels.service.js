const prisma = require('../../config/prisma');

function toSlug(str) {
  return str.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

const modelInclude = {
  brand: { select: { id: true, name: true } },
  vehicleType: { select: { id: true, name: true, slug: true } },
};

const getAll = async ({ brandId, vehicleTypeId, isActive } = {}) => {
  const where = {};
  if (brandId) where.brandId = brandId;
  if (vehicleTypeId) where.vehicleTypeId = vehicleTypeId;
  if (isActive !== undefined) where.isActive = isActive === 'true' || isActive === true;
  return prisma.carModel.findMany({
    where,
    include: modelInclude,
    orderBy: [{ brand: { name: 'asc' } }, { name: 'asc' }],
  });
};

const getById = async (id) => {
  const model = await prisma.carModel.findUnique({ where: { id }, include: modelInclude });
  if (!model) throw Object.assign(new Error('Car model not found'), { statusCode: 404 });
  return model;
};

const create = async (data) => {
  const brand = await prisma.carBrand.findUnique({ where: { id: data.brandId } });
  if (!brand) throw Object.assign(new Error('Car brand not found'), { statusCode: 404 });
  const vt = await prisma.vehicleType.findUnique({ where: { id: data.vehicleTypeId } });
  if (!vt) throw Object.assign(new Error('Vehicle type not found'), { statusCode: 404 });

  const slug = toSlug(`${brand.name}-${data.name}`);
  return prisma.carModel.create({ data: { ...data, slug }, include: modelInclude });
};

const update = async (id, data) => {
  const existing = await getById(id);

  const updateData = { ...data };

  if (data.name || data.brandId) {
    const brandId = data.brandId ?? existing.brandId;
    const name = data.name ?? existing.name;
    const brand = await prisma.carBrand.findUnique({ where: { id: brandId } });
    if (!brand) throw Object.assign(new Error('Car brand not found'), { statusCode: 404 });
    updateData.slug = toSlug(`${brand.name}-${name}`);
  }

  if (data.vehicleTypeId) {
    const vt = await prisma.vehicleType.findUnique({ where: { id: data.vehicleTypeId } });
    if (!vt) throw Object.assign(new Error('Vehicle type not found'), { statusCode: 404 });
  }

  return prisma.carModel.update({ where: { id }, data: updateData, include: modelInclude });
};

const remove = async (id) => {
  await getById(id);
  return prisma.carModel.delete({ where: { id } });
};

module.exports = { getAll, getById, create, update, remove };
