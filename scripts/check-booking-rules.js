// Self-check for the booking rules that are easy to break silently.
// Run: TZ=UTC node scripts/check-booking-rules.js && TZ=Asia/Kolkata node scripts/check-booking-rules.js
const assert = require('assert');
const { normalizePlate, isValidPlate } = require('../src/utils/plate');
const { toIST } = require('../src/modules/slots/slots.service');

// Plates: normalise, then standard or BH series.
assert.strictEqual(normalizePlate('ka 01 ab-1234'), 'KA01AB1234');
assert.strictEqual(normalizePlate('  '), null);
assert.strictEqual(normalizePlate(undefined), null);
for (const ok of ['KA01AB1234', 'DL3CAF0001', 'MH12A1234', 'GJ011234', '22BH1234AA']) assert(isValidPlate(ok), ok);
for (const bad of ['ABC', 'KA01AB123', '22BH1234', 'KA01ABCD1234', '']) assert(!isValidPlate(bad), bad);

// IST wall clock must not depend on the server's timezone (VPS runs UTC).
const tenThirty = new Date('2026-10-20T10:30:00+05:30');
assert.deepStrictEqual(toIST(tenThirty), { date: '2026-10-20', time: '10:30', mins: 630 });
assert.strictEqual(toIST(new Date('2026-10-20T23:45:00+05:30')).date, '2026-10-20');
assert.strictEqual(toIST(new Date('2026-10-20T00:15:00+05:30')).date, '2026-10-20');

console.log(`booking rules ok (TZ=${process.env.TZ ?? 'system'})`);
