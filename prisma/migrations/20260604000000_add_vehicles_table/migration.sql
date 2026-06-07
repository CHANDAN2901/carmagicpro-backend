-- Creates the vehicles table. Previously this table was created out-of-band via
-- the untracked prisma/migrations/add_vehicle_model.sql script, which left it
-- missing from the migration history and broke clean replays (the later
-- 20260605000001 migration ALTERs this table). This migration restores it to
-- the tracked history. Columns car_model_id / fuel_type are added by 20260605000001.

-- CreateTable
CREATE TABLE "vehicles" (
    "id"              TEXT NOT NULL,
    "user_id"         TEXT NOT NULL,
    "vehicle_type_id" TEXT NOT NULL,
    "plate_number"    TEXT NOT NULL,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vehicles_user_id_idx" ON "vehicles"("user_id");

-- CreateIndex
CREATE INDEX "vehicles_vehicle_type_id_idx" ON "vehicles"("vehicle_type_id");

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_vehicle_type_id_fkey" FOREIGN KEY ("vehicle_type_id") REFERENCES "vehicle_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
