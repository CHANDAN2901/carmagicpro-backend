-- Membership wash coupons: one single-use coupon per wash of a membership.
ALTER TABLE "coupons" ADD COLUMN "membership_id" TEXT;
ALTER TABLE "coupons" ADD COLUMN "tier_name" TEXT;
ALTER TABLE "coupons" ADD COLUMN "wash_no" INTEGER;

CREATE UNIQUE INDEX "coupons_membership_id_wash_no_key" ON "coupons"("membership_id", "wash_no");

ALTER TABLE "coupons" ADD CONSTRAINT "coupons_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;
