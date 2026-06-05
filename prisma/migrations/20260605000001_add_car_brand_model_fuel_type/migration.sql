-- Migration: add_car_brand_model_fuel_type
-- Adds FuelType enum, CarBrand, CarModel tables
-- Extends Vehicle and Booking with car model + fuel type columns

-- CreateEnum
CREATE TYPE "FuelType" AS ENUM ('PETROL', 'DIESEL', 'CNG', 'ELECTRIC', 'HYBRID');

-- CreateTable: car_brands
CREATE TABLE "car_brands" (
    "id"         TEXT NOT NULL,
    "name"       TEXT NOT NULL,
    "slug"       TEXT NOT NULL,
    "is_active"  BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "car_brands_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "car_brands_name_key" ON "car_brands"("name");
CREATE UNIQUE INDEX "car_brands_slug_key" ON "car_brands"("slug");
CREATE INDEX "car_brands_is_active_idx" ON "car_brands"("is_active");

-- CreateTable: car_models
CREATE TABLE "car_models" (
    "id"              TEXT NOT NULL,
    "brand_id"        TEXT NOT NULL,
    "vehicle_type_id" TEXT NOT NULL,
    "name"            TEXT NOT NULL,
    "slug"            TEXT NOT NULL,
    "fuel_types"      "FuelType"[] DEFAULT ARRAY[]::"FuelType"[],
    "is_active"       BOOLEAN NOT NULL DEFAULT true,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "car_models_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "car_models_slug_key" ON "car_models"("slug");
CREATE UNIQUE INDEX "car_models_brand_id_name_key" ON "car_models"("brand_id", "name");
CREATE INDEX "car_models_brand_id_idx" ON "car_models"("brand_id");
CREATE INDEX "car_models_vehicle_type_id_idx" ON "car_models"("vehicle_type_id");
CREATE INDEX "car_models_is_active_idx" ON "car_models"("is_active");

-- AddForeignKey: car_models -> car_brands (cascade delete)
ALTER TABLE "car_models"
    ADD CONSTRAINT "car_models_brand_id_fkey"
    FOREIGN KEY ("brand_id") REFERENCES "car_brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: car_models -> vehicle_types (restrict — must reassign models before deleting type)
ALTER TABLE "car_models"
    ADD CONSTRAINT "car_models_vehicle_type_id_fkey"
    FOREIGN KEY ("vehicle_type_id") REFERENCES "vehicle_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: vehicles — add car_model_id and fuel_type (nullable for backward compat)
ALTER TABLE "vehicles"
    ADD COLUMN "car_model_id" TEXT,
    ADD COLUMN "fuel_type"    "FuelType";

CREATE INDEX "vehicles_car_model_id_idx" ON "vehicles"("car_model_id");

ALTER TABLE "vehicles"
    ADD CONSTRAINT "vehicles_car_model_id_fkey"
    FOREIGN KEY ("car_model_id") REFERENCES "car_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: bookings — promote vehicle info to proper columns
ALTER TABLE "bookings"
    ADD COLUMN "vehicle_type_id" TEXT,
    ADD COLUMN "car_model_id"    TEXT,
    ADD COLUMN "fuel_type"       "FuelType",
    ADD COLUMN "plate_number"    TEXT;

CREATE INDEX "bookings_vehicle_type_id_idx" ON "bookings"("vehicle_type_id");

ALTER TABLE "bookings"
    ADD CONSTRAINT "bookings_vehicle_type_id_fkey"
    FOREIGN KEY ("vehicle_type_id") REFERENCES "vehicle_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "bookings"
    ADD CONSTRAINT "bookings_car_model_id_fkey"
    FOREIGN KEY ("car_model_id") REFERENCES "car_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;
