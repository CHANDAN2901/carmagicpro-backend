-- Coupon reuse is now tracked per vehicle plate (in addition to the existing
-- per-phone tracking) so a coupon can't be reused on the same vehicle even
-- from a different account, while the same user can still use it once per
-- distinct vehicle.
ALTER TABLE "coupon_usages" ADD COLUMN "plate_number" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "coupon_usages_coupon_id_plate_number_key" ON "coupon_usages"("coupon_id", "plate_number");
