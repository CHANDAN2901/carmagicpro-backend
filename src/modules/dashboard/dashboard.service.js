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
    prisma.user.count({ where: { role: 'CUSTOMER' } }),
    prisma.user.count({ where: { role: 'CUSTOMER', createdAt: { lt: startOfMonth } } }),
    prisma.order.count(),
    prisma.order.count({ where: { createdAt: { lt: startOfMonth } } }),
    prisma.booking.count(),
    prisma.booking.count({ where: { createdAt: { lt: startOfMonth } } }),
    prisma.payment.aggregate({ _sum: { amount: true }, where: { status: 'CAPTURED' } }),
    prisma.payment.aggregate({ _sum: { amount: true }, where: { status: 'CAPTURED', createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } } }),
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

  const totalRevenue = Number(revenueResult._sum.amount ?? 0);
  const lastMonthRevenue = Number(revenueLastMonthResult._sum.amount ?? 0);

  const revenueByMembership = await getMembershipRevenue();

  return {
    stats: {
      totalUsers: { value: totalUsers, change: pct(totalUsers, usersLastMonth) },
      totalOrders: { value: totalOrders, change: pct(totalOrders, ordersLastMonth) },
      totalBookings: { value: totalBookings, change: pct(totalBookings, bookingsLastMonth) },
      totalRevenue: { value: totalRevenue, change: pct(totalRevenue, lastMonthRevenue) },
    },
    revenueByMembership,
    recentOrders,
    recentBookings,
  };
};

// Revenue actually collected (CAPTURED payments) per membership plan.
const getMembershipRevenue = async () => {
  const grouped = await prisma.payment.groupBy({
    by: ['entityId'],
    where: { entityType: 'MEMBERSHIP', status: 'CAPTURED' },
    _sum: { amount: true },
  });
  if (!grouped.length) return [];

  const memberships = await prisma.membership.findMany({
    where: { id: { in: grouped.map((g) => g.entityId) } },
    select: { id: true, planKey: true, planName: true },
  });
  const planById = new Map(memberships.map((m) => [m.id, m]));

  const byPlan = new Map();
  for (const g of grouped) {
    const plan = planById.get(g.entityId);
    if (!plan) continue;
    const revenue = Number(g._sum.amount ?? 0);
    const entry = byPlan.get(plan.planKey) ?? { planKey: plan.planKey, planName: plan.planName, revenue: 0, count: 0 };
    entry.revenue += revenue;
    entry.count += 1;
    byPlan.set(plan.planKey, entry);
  }
  return Array.from(byPlan.values()).sort((a, b) => b.revenue - a.revenue);
};

// ─── Trends ─────────────────────────────────────────────────────────────────
// Daily counts of orders and bookings within [from, to] (inclusive), returned
// as a continuous series with zero-filled gaps so the chart has no holes.
const DAY_MS = 24 * 60 * 60 * 1000;
const toKey = (d) => d.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)

const getTrends = async ({ from, to } = {}) => {
  const now = new Date();
  // Default: last 30 days (inclusive of today).
  const end = to ? new Date(to) : now;
  const start = from ? new Date(from) : new Date(end.getTime() - 29 * DAY_MS);

  // Normalise to full-day bounds.
  const rangeStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate(), 0, 0, 0));
  const rangeEnd = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate(), 23, 59, 59, 999));

  const where = { createdAt: { gte: rangeStart, lte: rangeEnd } };

  const [orders, bookings] = await Promise.all([
    prisma.order.findMany({ where, select: { createdAt: true } }),
    prisma.booking.findMany({ where, select: { createdAt: true } }),
  ]);

  // Build a zero-filled bucket for every day in the range.
  const buckets = new Map();
  for (let t = rangeStart.getTime(); t <= rangeEnd.getTime(); t += DAY_MS) {
    buckets.set(toKey(new Date(t)), { date: toKey(new Date(t)), orders: 0, bookings: 0 });
  }
  for (const o of orders) {
    const b = buckets.get(toKey(o.createdAt));
    if (b) b.orders += 1;
  }
  for (const bk of bookings) {
    const b = buckets.get(toKey(bk.createdAt));
    if (b) b.bookings += 1;
  }

  return {
    trends: Array.from(buckets.values()),
    range: { from: toKey(rangeStart), to: toKey(rangeEnd) },
  };
};

module.exports = { getStats, getTrends };
