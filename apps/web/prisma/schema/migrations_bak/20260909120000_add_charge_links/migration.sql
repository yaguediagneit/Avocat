-- AddColumns
ALTER TABLE "charges" ADD COLUMN IF NOT EXISTS "dossier_id" TEXT;
ALTER TABLE "charges" ADD COLUMN IF NOT EXISTS "tache_id" TEXT;
ALTER TABLE "charges" ADD COLUMN IF NOT EXISTS "mission_huissier_id" TEXT;

-- AddForeignKey
ALTER TABLE "charges" ADD CONSTRAINT "charges_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "dossiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charges" ADD CONSTRAINT "charges_tache_id_fkey" FOREIGN KEY ("tache_id") REFERENCES "taches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charges" ADD CONSTRAINT "charges_mission_huissier_id_fkey" FOREIGN KEY ("mission_huissier_id") REFERENCES "missions_huissier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "charges_dossier_id_idx" ON "charges"("dossier_id");

-- CreateIndex
CREATE INDEX "charges_tache_id_idx" ON "charges"("tache_id");

-- CreateIndex
CREATE INDEX "charges_mission_huissier_id_idx" ON "charges"("mission_huissier_id");
