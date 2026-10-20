const prisma = require('../config/prisma');

// A PENDING booking is a temporary slot hold created *before* payment.
// COD bookings are confirmed immediately; Razorpay bookings stay PENDING until
// the payment signature is verified. So any PENDING booking older than this
// window is an abandoned / failed checkout — its slot must be released so other
// customers can book it. We do this lazily (on read) to avoid a cron dependency.
const BOOKING_HOLD_MINS = 15;

// Cancels PENDING bookings whose hold has expired. Cheap indexed updateMany;
// safe to call on every slot/booking read. If a late payment somehow verifies
// after release, verifyPayment still flips the booking to CONFIRMED.
// `client` lets callers run this inside their own transaction.
const releaseStaleBookings = async (client = prisma) => {
  const cutoff = new Date(Date.now() - BOOKING_HOLD_MINS * 60 * 1000);
  try {
    // A booking with an unpaid Razorpay payment link outlives the 15-min hold
    // window — the customer may take longer than that to actually pay — so
    // exclude those bookings and let Razorpay's own link expiry govern them.
    const linkedBookingIds = await client.payment.findMany({
      where: { entityType: 'BOOKING', status: 'CREATED', razorpayPaymentLinkId: { not: null } },
      select: { entityId: true },
    });
    return await client.booking.updateMany({
      where: {
        status: 'PENDING',
        createdAt: { lt: cutoff },
        id: { notIn: linkedBookingIds.map((p) => p.entityId) },
      },
      data: { status: 'CANCELLED' },
    });
  } catch (err) {
    // Never let cleanup failure break the read path.
    console.error('[releaseStaleBookings] failed:', err?.message);
  }
};

module.exports = { releaseStaleBookings, BOOKING_HOLD_MINS };
