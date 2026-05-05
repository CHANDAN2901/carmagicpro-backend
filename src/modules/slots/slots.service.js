const prisma = require('../../config/prisma');

const DEFAULT_CONFIG = { workStartTime: '09:00', workEndTime: '18:00', employeeTeams: 3, slotIntervalMins: 30 };

const getConfig = async () => {
  const config = await prisma.slotConfig.findFirst();
  return config || DEFAULT_CONFIG;
};

const saveConfig = async (data) => {
  const existing = await prisma.slotConfig.findFirst();
  if (existing) {
    return prisma.slotConfig.update({ where: { id: existing.id }, data });
  }
  return prisma.slotConfig.create({ data });
};

// Parse "HH:mm" into total minutes from midnight
function toMins(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function toTimeStr(mins) {
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

const getAvailableSlots = async ({ date, serviceId }) => {
  if (!date || !serviceId) throw Object.assign(new Error('date and serviceId are required'), { statusCode: 400 });

  const config = await getConfig();
  const service = await prisma.service.findUnique({ where: { id: serviceId }, select: { durationMins: true } });
  if (!service) throw Object.assign(new Error('Service not found'), { statusCode: 404 });

  // Check blocked date
  const targetDate = new Date(date);
  const blocked = await prisma.blockedDate.findUnique({ where: { date: targetDate } });
  if (blocked) return [];

  const startMins = toMins(config.workStartTime);
  const endMins = toMins(config.workEndTime);
  const duration = service.durationMins;
  const interval = config.slotIntervalMins;

  // Build all candidate start times
  const candidates = [];
  for (let t = startMins; t + duration <= endMins; t += interval) {
    candidates.push(t);
  }

  if (candidates.length === 0) return [];

  // Fetch all non-cancelled bookings for that date that involve this service's window
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const bookings = await prisma.booking.findMany({
    where: {
      scheduledAt: { gte: dayStart, lte: dayEnd },
      status: { notIn: ['CANCELLED'] },
    },
    include: { service: { select: { durationMins: true } } },
  });

  const slots = candidates.map((slotStartMins) => {
    const slotEndMins = slotStartMins + duration;

    // Count overlapping bookings: a booking overlaps if its [start, start+duration) intersects [slotStart, slotEnd)
    const overlapping = bookings.filter((b) => {
      const bStart = b.scheduledAt.getHours() * 60 + b.scheduledAt.getMinutes();
      const bEnd = bStart + (b.service?.durationMins ?? 30);
      return bStart < slotEndMins && bEnd > slotStartMins;
    });

    return {
      time: toTimeStr(slotStartMins),
      available: overlapping.length < config.employeeTeams,
      bookedCount: overlapping.length,
      capacity: config.employeeTeams,
    };
  });

  return slots;
};

const getBlockedDates = async () => {
  return prisma.blockedDate.findMany({ orderBy: { date: 'asc' } });
};

const addBlockedDate = async ({ date, reason }) => {
  return prisma.blockedDate.create({ data: { date: new Date(date), reason } });
};

const removeBlockedDate = async (id) => {
  const exists = await prisma.blockedDate.findUnique({ where: { id } });
  if (!exists) throw Object.assign(new Error('Blocked date not found'), { statusCode: 404 });
  return prisma.blockedDate.delete({ where: { id } });
};

module.exports = { getConfig, saveConfig, getAvailableSlots, getBlockedDates, addBlockedDate, removeBlockedDate };
