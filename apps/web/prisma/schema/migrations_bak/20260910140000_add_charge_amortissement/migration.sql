-- AlterTable
ALTER TABLE "charges"
  ADD COLUMN "immobilisation_mode" TEXT,
  ADD COLUMN "immobilisation_account_code" TEXT,
  ADD COLUMN "amortissement_start_date" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "charge_amortissements" (
    "id" TEXT NOT NULL,
    "charge_id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "period_year" INTEGER NOT NULL,
    "period_month" INTEGER NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "cumul" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "vnc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "is_posted" BOOLEAN NOT NULL DEFAULT false,
    "posted_at" TIMESTAMP(3),
    "accounting_entry_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "charge_amortissements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "charge_amortissements_charge_id_numero_key" ON "charge_amortissements"("charge_id", "numero");

-- CreateIndex
CREATE INDEX "charge_amortissements_charge_id_idx" ON "charge_amortissements"("charge_id");

-- CreateIndex
CREATE INDEX "charge_amortissements_due_date_idx" ON "charge_amortissements"("due_date");

-- CreateIndex
CREATE INDEX "charge_amortissements_is_posted_idx" ON "charge_amortissements"("is_posted");

-- AddForeignKey
ALTER TABLE "charge_amortissements" ADD CONSTRAINT "charge_amortissements_charge_id_fkey" FOREIGN KEY ("charge_id") REFERENCES "charges"("id") ON DELETE CASCADE ON UPDATE CASCADE;
