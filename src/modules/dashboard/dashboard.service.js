const prisma = require('../../config/prisma');

const getStats = async () => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const [
    totalUsers, usersLastMonth,
    totalOrders, ordersLastMonth,
    totalBookings, bookingsLastMonth,
    revenueResult, revenueLastMonthResult,
    recentOrders, recentBookings,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { lt: startOfMonth } } }),
    prisma.order.count(),
    prisma.order.count({ where: { createdAt: { lt: startOfMonth } } }),
    prisma.booking.count(),
    prisma.booking.count({ where: { createdAt: { lt: startOfMonth } } }),
    prisma.order.aggregate({ _sum: { totalAmount: true } }),
    prisma.order.aggregate({ _sum: { totalAmount: true }, where: { createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } } }),
    prisma.order.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, name: true } } },
    }),
    prisma.booking.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true } },
        service: { select: { id: true, name: true } },
      },
    }),
  ]);

  const pct = (curr, prev) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 100);
  };

  const totalRevenue = Number(revenueResult._sum.totalAmount ?? 0);
  const lastMonthRevenue = Number(revenueLastMonthResult._sum.totalAmount ?? 0);

  return {
    stats: {
      totalUsers: { value: totalUsers, change: pct(totalUsers, usersLastMonth) },
      totalOrders: { value: totalOrders, change: pct(totalOrders, ordersLastMonth) },
      totalBookings: { value: totalBookings, change: pct(totalBookings, bookingsLastMonth) },
      totalRevenue: { value: totalRevenue, change: pct(totalRevenue, lastMonthRevenue) },
    },
    recentOrders,
    recentBookings,
  };
};

module.exports = { getStats };
