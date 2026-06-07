-- Pricing/stock move to variants. Product price/stock become optional (no
-- longer authoritative), variants gain a discount price, and order items
-- record which variant was purchased.

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "variation_id" TEXT;

-- AlterTable
ALTER TABLE "product_variations" ADD COLUMN     "discount_price" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "products" ALTER COLUMN "price" DROP NOT NULL,
ALTER COLUMN "stock" DROP NOT NULL,
ALTER COLUMN "stock" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "order_items_variation_id_idx" ON "order_items"("variation_id");

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variation_id_fkey" FOREIGN KEY ("variation_id") REFERENCES "product_variations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
