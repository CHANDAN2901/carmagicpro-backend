const prisma = require('../../config/prisma');
const { releaseStaleBookings } = require('../../utils/releaseStaleBookings');

const DEFAULT_CONFIG = { workStartTime: '09:00', workEndTime: '18:00', employeeTeams: 3, slotIntervalMins: 30 };

const getConfig = async (client = prisma) => {
  const config = await client.slotConfig.findFirst();
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

// Wall-clock date/time in IST. Slots are IST, but the server process runs in UTC
// on the VPS, so never use getHours()/setHours() on booking timestamps.
const IST_OFFSET_MS = 330 * 60 * 1000;
const toIST = (d) => {
  const iso = new Date(new Date(d).getTime() + IST_OFFSET_MS).toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16), mins: toMins(iso.slice(11, 16)) };
};

// `client` lets createBooking run the availability check inside its transaction.
const getAvailableSlots = async ({ date, serviceId }, client = prisma) => {
  if (!date || !serviceId) throw Object.assign(new Error('date and serviceId are required'), { statusCode: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw Object.assign(new Error('date must be YYYY-MM-DD'), { statusCode: 400 });

  const config = await getConfig(client);
  const service = await client.service.findUnique({ where: { id: serviceId }, select: { durationMins: true } });
  if (!service) throw Object.assign(new Error('Service not found'), { statusCode: 404 });

  // Check blocked date
  const targetDate = new Date(date);
  const blocked = await client.blockedDate.findUnique({ where: { date: targetDate } });
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

  // Release abandoned holds first so their slots don't stay blocked forever.
  await releaseStaleBookings(client);

  // Fetch all non-cancelled bookings for that IST day (live PENDING holds count as taken)
  const bookings = await client.booking.findMany({
    where: {
      scheduledAt: { gte: new Date(`${date}T00:00:00+05:30`), lte: new Date(`${date}T23:59:59.999+05:30`) },
      status: { notIn: ['CANCELLED'] },
    },
    include: { service: { select: { durationMins: true } } },
  });

  const now = toIST(new Date());
  const slots = candidates.map((slotStartMins) => {
    const slotEndMins = slotStartMins + duration;
    const isPast = date < now.date || (date === now.date && slotStartMins <= now.mins);

    // Count overlapping bookings: a booking overlaps if its [start, start+duration) intersects [slotStart, slotEnd)
    const overlapping = bookings.filter((b) => {
      const bStart = toIST(b.scheduledAt).mins;
      const bEnd = bStart + (b.service?.durationMins ?? 30);
      return bStart < slotEndMins && bEnd > slotStartMins;
    });

    return {
      time: toTimeStr(slotStartMins),
      available: !isPast && overlapping.length < config.employeeTeams,
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

module.exports = { getConfig, saveConfig, getAvailableSlots, getBlockedDates, addBlockedDate, removeBlockedDate, toIST };
