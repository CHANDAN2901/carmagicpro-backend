const prisma = require('../../config/prisma');
const { deleteFromR2 } = require('../../utils/r2');

function toSlug(name) {
  return name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

const serviceInclude = {
  category: { select: { id: true, name: true } },
  pricings: {
    include: { vehicleType: { select: { id: true, name: true } } },
    orderBy: { vehicleType: { name: 'asc' } },
  },
};

const getAll = async ({ categoryId, isActive } = {}) => {
  const where = {};
  if (categoryId) where.categoryId = categoryId;
  if (isActive !== undefined) where.isActive = isActive === 'true' || isActive === true;

  return prisma.service.findMany({
    where,
    include: serviceInclude,
    orderBy: { name: 'asc' },
  });
};

const getById = async (id) => {
  const service = await prisma.service.findUnique({ where: { id }, include: serviceInclude });
  if (!service) throw Object.assign(new Error('Service not found'), { statusCode: 404 });
  return service;
};

const upsertPricings = async (serviceId, pricings) => {
  if (!pricings || pricings.length === 0) return;
  await Promise.all(
    pricings.map((p) =>
      prisma.servicePricing.upsert({
        where: { serviceId_vehicleTypeId: { serviceId, vehicleTypeId: p.vehicleTypeId } },
        create: { serviceId, vehicleTypeId: p.vehicleTypeId, price: p.price, originalPrice: p.originalPrice ?? null },
        update: { price: p.price, originalPrice: p.originalPrice ?? null },
      })
    )
  );
};

const create = async (data) => {
  const { pricings, ...serviceData } = data;
  const slug = toSlug(serviceData.name);
  // Only one service may be featured at a time — clear any existing one first.
  const service = await prisma.$transaction(async (tx) => {
    if (serviceData.isFeatured) {
      await tx.service.updateMany({ where: { isFeatured: true }, data: { isFeatured: false } });
    }
    return tx.service.create({ data: { ...serviceData, slug } });
  });
  await upsertPricings(service.id, pricings);
  return getById(service.id);
};

const update = async (id, data) => {
  await getById(id);
  const { pricings, ...serviceData } = data;
  if (serviceData.name) serviceData.slug = toSlug(serviceData.name);
  // Only one service may be featured at a time — clear any other featured service first.
  const service = await prisma.$transaction(async (tx) => {
    if (serviceData.isFeatured === true) {
      await tx.service.updateMany({ where: { isFeatured: true, NOT: { id } }, data: { isFeatured: false } });
    }
    return tx.service.update({ where: { id }, data: serviceData });
  });
  await upsertPricings(service.id, pricings);
  return getById(service.id);
};

const remove = async (id) => {
  const service = await getById(id);
  await prisma.booking.deleteMany({ where: { serviceId: id } });
  await prisma.service.delete({ where: { id } });
  const results = await Promise.allSettled(service.images.map(deleteFromR2));
  results.forEach((r, i) => { if (r.status === 'rejected') console.error('[R2] Failed to delete service image', service.images[i], r.reason); });
};

const bulkRemove = async (ids) => {
  let deleted = 0
  const failed = []
  for (const id of ids) {
    try { await remove(id); deleted++ } catch (e) { failed.push({ id, message: e.message }) }
  }
  return { deleted, failed }
}

module.exports = { getAll, getById, create, update, remove, bulkRemove };
