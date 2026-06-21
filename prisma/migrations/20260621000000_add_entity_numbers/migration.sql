-- Add human-readable, CMP-prefixed numbers for bookings and orders
ALTER TABLE "bookings" ADD COLUMN "booking_number" TEXT;
ALTER TABLE "orders" ADD COLUMN "order_number" TEXT;

CREATE UNIQUE INDEX "bookings_booking_number_key" ON "bookings"("booking_number");
CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");

-- Per-day sequence counters used to build the numbers (resets each day)
CREATE TABLE "daily_counters" (
    "id" TEXT NOT NULL,
    "last_seq" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "daily_counters_pkey" PRIMARY KEY ("id")
);
