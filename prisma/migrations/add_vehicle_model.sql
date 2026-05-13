-- Migration: add_vehicle_model
-- Run this against your database when connected

CREATE TABLE IF NOT EXISTS "vehicles" (
  "id"              TEXT NOT NULL,
  "user_id"         TEXT NOT NULL,
  "vehicle_type_id" TEXT NOT NULL,
  "plate_number"    TEXT NOT NULL,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "vehicles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "vehicles_vehicle_type_id_fkey" FOREIGN KEY ("vehicle_type_id") REFERENCES "vehicle_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
