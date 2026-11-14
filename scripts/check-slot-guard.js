// Self-check: admin bookings respect slot capacity, reschedule excludes the booking
// itself, and only unpaid PENDING memberships can be deleted.
// Run ONLY against a throwaway DB (it creates rows):
//   DATABASE_URL=postgresql://...test DIRECT_URL=$DATABASE_URL node scripts/check-slot-guard.js
const assert = require('assert');
const prisma = require('../src/config/prisma');
const bookings = require('../src/modules/bookings/bookings.service');
const memberships = require('../src/modules/memberships/memberships.service');
const slots = require('../src/modules/slots/slots.service');

const rejects409 = (p, msg) => assert.rejects(p, (e) => e.statusCode === 409, msg);

(async () => {
  if (!/127\.0\.0\.1|localhost/.test(process.env.DATABASE_URL ?? '')) throw new Error('Refusing: DATABASE_URL is not local');

  await slots.saveConfig({ workStartTime: '09:00', workEndTime: '18:00', employeeTeams: 1, slotIntervalMins: 30 });
  const tag = Date.now();
  const user = await prisma.user.create({ data: { name: 'Slot Check', phone: String(tag).slice(-10) } });
  const service = await prisma.service.create({ data: { name: 'Wash', slug: `wash-${tag}`, price: 500, durationMins: 30 } });
  const date = '2030-01-15';
  const at = (t) => new Date(`${date}T${t}:00+05:30`).toISOString();
  await prisma.booking.deleteMany({ where: { scheduledAt: { gte: new Date(at('00:00')), lte: new Date(at('23:59')) } } }); // rerunnable
  const base = { userId: user.id, serviceId: service.id, totalAmount: 500 };

  const a = await bookings.create({ ...base, scheduledAt: at('10:00') });
  await rejects409(bookings.create({ ...base, scheduledAt: at('10:00') }), 'double-booking a full slot must fail');
  await rejects409(bookings.create({ ...base, scheduledAt: at('10:10') }), 'off-grid time must fail');
  await rejects409(bookings.create({ ...base, scheduledAt: at('20:00') }), 'outside working hours must fail');

  const b = await bookings.create({ ...base, scheduledAt: at('11:00') });
  await bookings.update(a.id, { scheduledAt: at('10:00'), notes: 'same slot' }); // exclude-self
  await rejects409(bookings.update(b.id, { scheduledAt: at('10:00') }), 'reschedule onto a full slot must fail');
  await bookings.update(b.id, { scheduledAt: at('12:00'), plateNumber: 'KA01AB1234' });

  // Cancel frees the slot; un-cancelling once it's retaken must fail.
  await bookings.update(a.id, { status: 'CANCELLED' });
  const c = await bookings.create({ ...base, scheduledAt: at('10:00') });
  await rejects409(bookings.update(a.id, { status: 'CONFIRMED' }), 'un-cancel into a taken slot must fail');

  const avail = await slots.getAvailableSlots({ date, serviceId: service.id });
  assert.strictEqual(avail.find((s) => s.time === '10:00').available, false, 'website must see 10:00 as taken');
  assert.strictEqual(avail.find((s) => s.time === '11:00').available, true, '11:00 freed by reschedule');

  // Memberships: PENDING + unpaid → deletable; ACTIVE / paid → refused.
  const mk = (status) => prisma.membership.create({
    data: { userId: user.id, planKey: 'x', planName: 'X', washesPerYear: 1, price: 100, status },
  });
  const pending = await mk('PENDING');
  await prisma.payment.create({ data: { entityType: 'MEMBERSHIP', entityId: pending.id, userId: user.id, provider: 'RAZORPAY', status: 'CREATED', grossAmount: 100, amount: 100 } });
  await memberships.remove(pending.id);
  assert.strictEqual(await prisma.membership.count({ where: { id: pending.id } }), 0);
  assert.strictEqual(await prisma.payment.count({ where: { entityId: pending.id } }), 0);
  await rejects409(memberships.remove((await mk('ACTIVE')).id), 'ACTIVE membership must not be deletable');
  const paidPending = await mk('PENDING');
  await prisma.payment.create({ data: { entityType: 'MEMBERSHIP', entityId: paidPending.id, userId: user.id, provider: 'MANUAL', status: 'COD_PENDING', grossAmount: 100, amount: 100 } });
  await rejects409(memberships.remove(paidPending.id), 'membership with COD payment must not be deletable');

  console.log('slot guard + membership delete ok', { kept: [a.id, b.id, c.id].length });
  await prisma.$disconnect();
})().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
