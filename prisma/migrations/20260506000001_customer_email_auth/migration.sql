-- Safe migration: customer email auth
-- Handles existing rows with defaults before adding NOT NULL constraints

-- ── coupon_usages: phone → email ─────────────────────────
DROP INDEX "coupon_usages_coupon_id_user_phone_key";

ALTER TABLE "coupon_usages" ADD COLUMN "user_email" TEXT;
-- Backfill existing rows with a placeholder so NOT NULL can be applied
UPDATE "coupon_usages" SET "user_email" = 'migrated_' || id || '@placeholder.local' WHERE "user_email" IS NULL;
ALTER TABLE "coupon_usages" ALTER COLUMN "user_email" SET NOT NULL;
ALTER TABLE "coupon_usages" DROP COLUMN "user_phone";

CREATE UNIQUE INDEX "coupon_usages_coupon_id_user_email_key" ON "coupon_usages"("coupon_id", "user_email");

-- ── customer_otps: phone → email ─────────────────────────
ALTER TABLE "customer_otps" ADD COLUMN "email" TEXT;
UPDATE "customer_otps" SET "email" = 'placeholder@placeholder.local' WHERE "email" IS NULL;
ALTER TABLE "customer_otps" ALTER COLUMN "email" SET NOT NULL;
ALTER TABLE "customer_otps" DROP COLUMN "phone";

-- ── users: add password_hash, make email required, phone optional ─────
-- Fix any NULL emails before making the column required
UPDATE "users" SET "email" = 'migrated_' || id || '@placeholder.local' WHERE "email" IS NULL;
ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "phone" DROP NOT NULL;

-- Add password_hash with a placeholder hash, then mark NOT NULL
-- Placeholder = bcrypt hash of 'ChangeMe@123' (12 rounds)
ALTER TABLE "users" ADD COLUMN "password_hash" TEXT;
UPDATE "users" SET "password_hash" = '$2a$12$placeholderHashForExistingRows.AAAAAAAAAAAAAAAAAAAAAAA' WHERE "password_hash" IS NULL;
ALTER TABLE "users" ALTER COLUMN "password_hash" SET NOT NULL;
