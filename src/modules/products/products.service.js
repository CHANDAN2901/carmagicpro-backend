const prisma = require('../../config/prisma');
const { deleteFromR2 } = require('../../utils/r2');

function toSlug(name) {
  return name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

const getAll = async ({ categoryId, isActive } = {}) => {
  const where = {};
  if (categoryId) where.categoryId = categoryId;
  if (isActive !== undefined) where.isActive = isActive === 'true' || isActive === true;

  return prisma.product.findMany({
    where,
    include: {
      category: { select: { id: true, name: true } },
      variations: true,
    },
    orderBy: { name: 'asc' },
  });
};

const getById = async (id) => {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: { select: { id: true, name: true } },
      variations: true,
    },
  });
  if (!product) throw Object.assign(new Error('Product not found'), { statusCode: 404 });
  return product;
};

const create = async ({ variations = [], ...data }) => {
  const slug = toSlug(data.name);
  return prisma.product.create({
    data: {
      ...data,
      slug,
      variations: variations.length ? { createMany: { data: variations } } : undefined,
    },
    include: { category: { select: { id: true, name: true } }, variations: true },
  });
};

const update = async (id, { variations, ...data }) => {
  await getById(id);
  const updateData = { ...data };
  if (data.name) updateData.slug = toSlug(data.name);

  return prisma.$transaction(async (tx) => {
    if (variations !== undefined) {
      const old = await tx.productVariation.findMany({ where: { productId: id }, select: { images: true } });
      await tx.productVariation.deleteMany({ where: { productId: id } });
      const oldImages = old.flatMap((v) => v.images ?? []);
      if (oldImages.length) await Promise.allSettled(oldImages.map(deleteFromR2));
      if (variations.length) {
        await tx.productVariation.createMany({ data: variations.map((v) => ({ ...v, productId: id })) });
      }
    }
    return tx.product.update({
      where: { id },
      data: updateData,
      include: { category: { select: { id: true, name: true } }, variations: true },
    });
  });
};

const remove = async (id) => {
  const product = await getById(id);
  await prisma.product.delete({ where: { id } });
  const allImages = [
    ...product.images,
    ...(product.variations ?? []).flatMap((v) => v.images ?? []),
  ];
  const results = await Promise.allSettled(allImages.map(deleteFromR2));
  results.forEach((r, i) => { if (r.status === 'rejected') console.error('[R2] Failed to delete product image', allImages[i], r.reason); });
};

module.exports = { getAll, getById, create, update, remove };
