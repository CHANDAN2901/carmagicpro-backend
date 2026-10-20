-- AlterTable
ALTER TABLE "bookings" ADD COLUMN "address" TEXT,
ADD COLUMN "address_details" JSONB,
ADD COLUMN "is_home_pickup" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "original_price" DECIMAL(10,2);

-- Registration numbers are now stored normalised (uppercase, no spaces / '-' / '.').
-- Collapse coupon usages that only differed by formatting first, so the
-- (coupon_id, plate_number) unique index survives the normalisation.
DELETE FROM "coupon_usages" a USING "coupon_usages" b
WHERE a.coupon_id = b.coupon_id
  AND a.id > b.id
  AND a.plate_number IS NOT NULL
  AND b.plate_number IS NOT NULL
  AND upper(regexp_replace(a.plate_number, '[[:space:].-]', '', 'g'))
    = upper(regexp_replace(b.plate_number, '[[:space:].-]', '', 'g'));

UPDATE "coupon_usages" SET "plate_number" = upper(regexp_replace("plate_number", '[[:space:].-]', '', 'g')) WHERE "plate_number" IS NOT NULL;
UPDATE "bookings" SET "plate_number" = upper(regexp_replace("plate_number", '[[:space:].-]', '', 'g')) WHERE "plate_number" IS NOT NULL;
UPDATE "vehicles" SET "plate_number" = upper(regexp_replace("plate_number", '[[:space:].-]', '', 'g'));
