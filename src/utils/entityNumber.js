const prisma = require('../config/prisma');

// Builds a human-readable, CMP-prefixed number that resets its sequence daily,
// e.g. "CMP2606190001" = CMP + YYMMDD + zero-padded sequence for that day.
//
// The counter is incremented with an atomic INSERT ... ON CONFLICT so concurrent
// requests never receive the same sequence. Pass a transaction client to keep the
// number generation inside the same transaction as the row insert.
const generateEntityNumber = async (entity, client = prisma) => {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const datePart = `${yy}${mm}${dd}`;
  const counterId = `${entity}-${datePart}`;

  const rows = await client.$queryRaw`
    INSERT INTO daily_counters (id, last_seq)
    VALUES (${counterId}, 1)
    ON CONFLICT (id) DO UPDATE SET last_seq = daily_counters.last_seq + 1
    RETURNING last_seq
  `;
  const seq = Number(rows[0].last_seq);
  return `CMP${datePart}${String(seq).padStart(4, '0')}`;
};

const generateBookingNumber = (client) => generateEntityNumber('BOOKING', client);
const generateOrderNumber = (client) => generateEntityNumber('ORDER', client);

module.exports = { generateEntityNumber, generateBookingNumber, generateOrderNumber };
