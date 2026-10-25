-- AlterTable
ALTER TABLE "accounting_accounts" ADD COLUMN "nature" TEXT NOT NULL DEFAULT 'mouvementable';

-- CreateIndex
CREATE INDEX "accounting_accounts_nature_idx" ON "accounting_accounts"("nature" ASC);

-- CreateTable
CREATE TABLE "payroll_contribution_rules" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "regime" TEXT NOT NULL DEFAULT 'general',
    "label" TEXT NOT NULL,
    "organism" TEXT,
    "branch" TEXT,
    "employee_rate" DOUBLE PRECISION NOT NULL,
    "employer_rate" DOUBLE PRECISION NOT NULL,
    "monthly_ceiling" INTEGER,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "account_employee" TEXT,
    "account_employer" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_contribution_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payroll_contribution_rules_code_regime_effective_from_idx" ON "payroll_contribution_rules"("code" ASC, "regime" ASC, "effective_from" ASC);

-- CreateIndex
CREATE INDEX "payroll_contribution_rules_is_active_effective_from_effective_to_idx" ON "payroll_contribution_rules"("is_active" ASC, "effective_from" ASC, "effective_to" ASC);

-- Backfill nature des comptes existants
UPDATE "accounting_accounts" SET "nature" = 'auxiliaire' WHERE "is_auxiliary" = true;

UPDATE "accounting_accounts" parent
SET "nature" = 'collectif'
WHERE parent."is_auxiliary" = false
  AND parent."nature" = 'mouvementable'
  AND EXISTS (
    SELECT 1 FROM "accounting_accounts" child
    WHERE child."parent_id" = parent."id"
  );

UPDATE "accounting_accounts"
SET "nature" = 'presentation'
WHERE "nature" = 'mouvementable'
  AND (
    "account_code" LIKE '12%' OR "account_code" LIKE '13%'
  );
