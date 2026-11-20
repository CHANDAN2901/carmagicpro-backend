-- Coupons can be limited to services (bookings + memberships) or products (orders).
CREATE TYPE "CouponScope" AS ENUM ('ALL', 'SERVICE', 'PRODUCT');
ALTER TABLE "coupons" ADD COLUMN "applies_to" "CouponScope" NOT NULL DEFAULT 'ALL';
