-- Admin manual entry needs to distinguish cash collected in person from COD
-- ("pay later, collect on arrival"), which already uses the COD value.
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'CASH';

-- Memberships now collect vehicle + address details at purchase time, stored
-- as scalar columns the same way bookings already do (no Vehicle relation).
ALTER TABLE "memberships"
    ADD COLUMN "vehicle_type_id" TEXT,
    ADD COLUMN "car_model_id"    TEXT,
    ADD COLUMN "fuel_type"       "FuelType",
    ADD COLUMN "plate_number"    TEXT,
    ADD COLUMN "address"         TEXT;

ALTER TABLE "memberships"
    ADD CONSTRAINT "memberships_vehicle_type_id_fkey"
    FOREIGN KEY ("vehicle_type_id") REFERENCES "vehicle_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "memberships"
    ADD CONSTRAINT "memberships_car_model_id_fkey"
    FOREIGN KEY ("car_model_id") REFERENCES "car_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;
