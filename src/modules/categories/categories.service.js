const prisma = require('../../config/prisma');
const { deleteFromR2 } = require('../../utils/r2');

function toSlug(name) {
  return name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

// Build a nested tree from a flat list
function buildTree(items, parentId = null) {
  return items
    .filter((i) => (i.parentId ?? null) === parentId)
    .map((i) => ({ ...i, children: buildTree(items, i.id) }));
}

// Flatten a tree depth-first, adding `depth` and `path` to each node
function flattenTree(nodes, ancestorPath = null, depth = 0) {
  return nodes.flatMap((node) => {
    const path = ancestorPath ? `${ancestorPath} > ${node.name}` : node.name;
    return [
      { ...node, depth, path },
      ...flattenTree(node.children ?? [], path, depth + 1),
    ];
  });
}

// Returns full nested tree (unlimited depth)
const getAll = async ({ type } = {}) => {
  const where = {};
  if (type === 'SERVICE') where.type = { in: ['SERVICE', 'BOTH'] };
  else if (type === 'PRODUCT') where.type = { in: ['PRODUCT', 'BOTH'] };

  const all = await prisma.category.findMany({ where, orderBy: { name: 'asc' } });
  return buildTree(all);
};

// Returns flat list with depth + path — used for dropdowns
const getAllFlat = async ({ type } = {}) => {
  const where = {};
  if (type === 'SERVICE') where.type = { in: ['SERVICE', 'BOTH'] };
  else if (type === 'PRODUCT') where.type = { in: ['PRODUCT', 'BOTH'] };

  const all = await prisma.category.findMany({ where, orderBy: { name: 'asc' } });
  const tree = buildTree(all);
  return flattenTree(tree);
};

const getById = async (id) => {
  const category = await prisma.category.findUnique({
    where: { id },
    include: { children: true },
  });
  if (!category) throw Object.assign(new Error('Category not found'), { statusCode: 404 });
  return category;
};

const create = async (data) => {
  const slug = toSlug(data.name);
  return prisma.category.create({ data: { ...data, slug } });
};

const update = async (id, data) => {
  await getById(id);
  // Prevent setting a category as its own parent
  if (data.parentId === id) {
    throw Object.assign(new Error('A category cannot be its own parent'), { statusCode: 400 });
  }
  const updateData = { ...data };
  if (data.name) updateData.slug = toSlug(data.name);
  return prisma.category.update({ where: { id }, data: updateData });
};

const remove = async (id) => {
  const category = await getById(id);

  const [childCount, serviceCount, productCount] = await Promise.all([
    prisma.category.count({ where: { parentId: id } }),
    prisma.service.count({ where: { categoryId: id } }),
    prisma.product.count({ where: { categoryId: id } }),
  ]);

  if (childCount > 0)
    throw Object.assign(new Error('Cannot delete category with subcategories. Delete or reassign them first.'), { statusCode: 400 });
  if (serviceCount > 0 || productCount > 0)
    throw Object.assign(new Error('Cannot delete category with linked services or products. Reassign them first.'), { statusCode: 400 });

  await prisma.category.delete({ where: { id } });
  if (category.imageUrl) await deleteFromR2(category.imageUrl);
};

module.exports = { getAll, getAllFlat, getById, create, update, remove };
