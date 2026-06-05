const prisma = require('../../config/prisma');

function toSlug(name) {
  return name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

const getAll = async ({ isActive } = {}) => {
  const where = {};
  if (isActive !== undefined) where.isActive = isActive === 'true' || isActive === true;
  return prisma.carBrand.findMany({
    where,
    orderBy: { name: 'asc' },
    include: { _count: { select: { models: true } } },
  });
};

const getById = async (id) => {
  const brand = await prisma.carBrand.findUnique({
    where: { id },
    include: { _count: { select: { models: true } } },
  });
  if (!brand) throw Object.assign(new Error('Car brand not found'), { statusCode: 404 });
  return brand;
};

const create = async (data) => {
  const slug = toSlug(data.name);
  return prisma.carBrand.create({ data: { ...data, slug } });
};

const update = async (id, data) => {
  await getById(id);
  const updateData = { ...data };
  if (data.name) updateData.slug = toSlug(data.name);
  return prisma.carBrand.update({ where: { id }, data: updateData });
};

const remove = async (id) => {
  await getById(id);
  return prisma.carBrand.delete({ where: { id } });
};

module.exports = { getAll, getById, create, update, remove };
