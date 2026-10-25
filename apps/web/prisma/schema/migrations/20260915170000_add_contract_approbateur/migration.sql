-- AlterTable
ALTER TABLE "employment_contracts" ADD COLUMN "approbateur_id" TEXT;

-- CreateIndex
CREATE INDEX "employment_contracts_approbateur_id_idx" ON "employment_contracts"("approbateur_id");

-- AddForeignKey
ALTER TABLE "employment_contracts" ADD CONSTRAINT "employment_contracts_approbateur_id_fkey" FOREIGN KEY ("approbateur_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
