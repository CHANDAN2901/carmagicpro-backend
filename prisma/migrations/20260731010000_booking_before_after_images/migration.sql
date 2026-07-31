-- AlterTable
ALTER TABLE "bookings" ADD COLUMN "before_images" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "bookings" ADD COLUMN "after_images" TEXT[] DEFAULT ARRAY[]::TEXT[];
