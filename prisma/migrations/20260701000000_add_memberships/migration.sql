-- Annual membership purchases. Plans themselves are static (defined in code),
-- so there is no plan-catalog table — only this record of each purchase.

-- Extend the shared payment entity type with MEMBERSHIP
ALTER TYPE "PaymentEntityType" ADD VALUE IF NOT EXISTS 'MEMBERSHIP';

-- Membership lifecycle status (EXPIRED is derived from expires_at, not stored)
DO $$ BEGIN
  CREATE TYPE "MembershipStatus" AS ENUM ('PENDING', 'ACTIVE', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE "memberships" (
    "id" TEXT NOT NULL,
    "membership_number" TEXT,
    "user_id" TEXT NOT NULL,
    "plan_key" TEXT NOT NULL,
    "plan_name" TEXT NOT NULL,
    "washes_per_year" INTEGER NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'PENDING',
    "start_date" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "memberships_membership_number_key" ON "memberships"("membership_number");
CREATE INDEX "memberships_user_id_idx" ON "memberships"("user_id");
CREATE INDEX "memberships_status_idx" ON "memberships"("status");
CREATE INDEX "memberships_expires_at_idx" ON "memberships"("expires_at");

ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
