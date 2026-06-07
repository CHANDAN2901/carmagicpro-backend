-- AlterTable
ALTER TABLE "services" ADD COLUMN "is_featured" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "services_is_featured_idx" ON "services"("is_featured");
