-- AlterTable
ALTER TABLE "insurer_payments" ADD COLUMN "approved_by" TEXT,
ADD COLUMN "approved_at" TIMESTAMP(3),
ADD COLUMN "paid_by" TEXT,
ADD COLUMN "paid_at" TIMESTAMP(3),
ADD COLUMN "accounting_entry_id" TEXT;

-- CreateIndex
CREATE INDEX "insurer_payments_accounting_entry_id_idx" ON "insurer_payments"("accounting_entry_id");
