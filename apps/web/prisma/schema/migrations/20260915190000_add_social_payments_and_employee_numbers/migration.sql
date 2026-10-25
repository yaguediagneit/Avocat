-- AlterTable
ALTER TABLE "employees" ADD COLUMN "irpp_number" TEXT;
ALTER TABLE "employees" ADD COLUMN "insurance_policy_number" TEXT;

-- CreateTable
CREATE TABLE "social_payments" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "period_year" INTEGER NOT NULL,
    "period_month" INTEGER,
    "period_start" TIMESTAMP(3),
    "period_end" TIMESTAMP(3),
    "employee_id" TEXT NOT NULL,
    "employee_number" TEXT,
    "amount" INTEGER NOT NULL,
    "prepared_by" TEXT NOT NULL,
    "prepared_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "accounting_entry_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "social_payments_status_idx" ON "social_payments"("status" ASC);

-- CreateIndex
CREATE INDEX "social_payments_period_year_period_month_idx" ON "social_payments"("period_year" ASC, "period_month" ASC);

-- CreateIndex
CREATE INDEX "social_payments_employee_id_type_idx" ON "social_payments"("employee_id" ASC, "type" ASC);

-- AddForeignKey
ALTER TABLE "social_payments" ADD CONSTRAINT "social_payments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
