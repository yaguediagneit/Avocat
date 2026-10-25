-- CreateTable
CREATE TABLE "conflits_interet" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "dossierConflitId" TEXT NOT NULL,
    "typeConflit" TEXT NOT NULL,
    "details" JSONB,
    "statut" TEXT NOT NULL DEFAULT 'detecte',
    "validePar" TEXT,
    "dateVerification" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conflits_interet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conflits_interet_dossierId_idx" ON "conflits_interet"("dossierId");

-- CreateIndex
CREATE INDEX "conflits_interet_dossierConflitId_idx" ON "conflits_interet"("dossierConflitId");

-- CreateIndex
CREATE INDEX "conflits_interet_statut_idx" ON "conflits_interet"("statut");

-- AddForeignKey
ALTER TABLE "conflits_interet" ADD CONSTRAINT "conflits_interet_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "dossiers"("id") ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE "conflits_interet" ADD CONSTRAINT "conflits_interet_dossierConflitId_fkey" FOREIGN KEY ("dossierConflitId") REFERENCES "dossiers"("id") ON DELETE RESTRICT;
