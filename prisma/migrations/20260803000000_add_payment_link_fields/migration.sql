-- AlterTable
ALTER TABLE "payments" ADD COLUMN "razorpay_payment_link_id" TEXT;
ALTER TABLE "payments" ADD COLUMN "payment_link_url" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "payments_razorpay_payment_link_id_key" ON "payments"("razorpay_payment_link_id");
