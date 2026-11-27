-- Membership coupons are now their own scope; SERVICE now means bookings only.
ALTER TYPE "CouponScope" ADD VALUE IF NOT EXISTS 'MEMBERSHIP';
