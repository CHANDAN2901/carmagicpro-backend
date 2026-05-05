ALTER TABLE "users" ADD COLUMN "is_verified" BOOLEAN NOT NULL DEFAULT false;

-- Mark existing seeded/test users as already verified so they still work
UPDATE "users" SET "is_verified" = true;
