-- AddColumns
ALTER TABLE "employment_contracts" ADD COLUMN "approbateur_id" TEXT;

-- CreateIndex
CREATE INDEX "employment_contracts_approbateur_id_idx" ON "employment_contracts"("approbateur_id");
