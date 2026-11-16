-- AlterTable
ALTER TABLE "memberships" ADD COLUMN     "plan_items" JSONB;

-- CreateTable
CREATE TABLE "membership_tiers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "default_mrp" DECIMAL(10,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "membership_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_tier_prices" (
    "id" TEXT NOT NULL,
    "tier_id" TEXT NOT NULL,
    "vehicle_type_id" TEXT NOT NULL,
    "mrp" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "membership_tier_prices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "membership_tiers_slug_key" ON "membership_tiers"("slug");

-- CreateIndex
CREATE INDEX "membership_tiers_is_active_idx" ON "membership_tiers"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "membership_tier_prices_tier_id_vehicle_type_id_key" ON "membership_tier_prices"("tier_id", "vehicle_type_id");

-- AddForeignKey
ALTER TABLE "membership_tier_prices" ADD CONSTRAINT "membership_tier_prices_tier_id_fkey" FOREIGN KEY ("tier_id") REFERENCES "membership_tiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_tier_prices" ADD CONSTRAINT "membership_tier_prices_vehicle_type_id_fkey" FOREIGN KEY ("vehicle_type_id") REFERENCES "vehicle_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Seed the 3 tiers that were hardcoded on the website (default MRP = Hatchback price).
INSERT INTO "membership_tiers" ("id", "name", "slug", "description", "features", "default_mrp", "sort_order", "updated_at") VALUES
('mtier_essential', 'Essential Care', 'essential', 'Perfect for regular maintenance to keep your car clean and fresh.',
  ARRAY['Exterior Foam Wash', 'Interior Vacuum', 'Tyre & Rim Cleaning', 'Scheduled Reminders', 'Priority Booking'], 999, 1, CURRENT_TIMESTAMP),
('mtier_complete', 'Complete Care', 'complete', 'All-round care for a spotless clean inside and out.',
  ARRAY['Everything in Essential', 'Interior Deep Cleaning', 'Dashboard Polishing', 'Glass Cleaning', 'Scheduled Reminders', 'Priority Booking'], 1599, 2, CURRENT_TIMESTAMP),
('mtier_luxury', 'Luxury Care', 'luxury', 'The ultimate care for your luxury and high-end vehicles.',
  ARRAY['Everything in Complete', 'Steam Sanitization', 'Wax Polish', 'AC Vent Cleaning', 'Odour Removal', 'Scheduled Reminders', 'Priority Booking'], 4999, 3, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;
