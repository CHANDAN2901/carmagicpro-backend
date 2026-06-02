const prisma = require('../../config/prisma');

const getAll = async ({ page = 1, limit = 20, search } = {}) => {
  const skip = (page - 1) * limit;
  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
    prisma.user.count({ where }),
  ]);

  return { users, total, page, limit };
};

const getById = async (id) => {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
  return user;
};

const create = async (data) => {
  return prisma.user.create({ data });
};

const update = async (id, data) => {
  await getById(id);
  return prisma.user.update({ where: { id }, data });
};

const remove = async (id) => {
  const user = await getById(id);
  if (user.role === 'ADMIN') throw Object.assign(new Error('Cannot delete an admin account'), { statusCode: 403 });
  return prisma.user.delete({ where: { id } });
};

module.exports = { getAll, getById, create, update, remove };
