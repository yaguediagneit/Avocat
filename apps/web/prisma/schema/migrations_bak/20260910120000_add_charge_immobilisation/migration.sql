-- AlterTable
ALTER TABLE "charges"
  ADD COLUMN "is_immobilisation" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "immobilisation_rate" DOUBLE PRECISION,
  ADD COLUMN "immobilisation_months" INTEGER,
  ADD COLUMN "monthly_payment" DOUBLE PRECISION;
