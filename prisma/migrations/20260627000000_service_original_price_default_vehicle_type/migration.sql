-- AlterTable: per-vehicle-type MRP/original price (nullable, struck-through on storefront)
ALTER TABLE "service_pricings" ADD COLUMN "original_price" DECIMAL(10,2);

-- AlterTable: admin-chosen default vehicle type whose price the service card headlines
ALTER TABLE "services" ADD COLUMN "default_vehicle_type_id" TEXT;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_default_vehicle_type_id_fkey" FOREIGN KEY ("default_vehicle_type_id") REFERENCES "vehicle_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
