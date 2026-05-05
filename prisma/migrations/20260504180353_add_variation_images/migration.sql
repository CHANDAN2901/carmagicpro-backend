-- AlterTable
ALTER TABLE "product_variations" ADD COLUMN     "images" TEXT[] DEFAULT ARRAY[]::TEXT[];
