-- AlterTable : ajout des champs de workflow de validation sur les documents
ALTER TABLE "documents" ADD COLUMN "statutValidation" TEXT NOT NULL DEFAULT 'brouillon';
ALTER TABLE "documents" ADD COLUMN "relecteurId" TEXT;
ALTER TABLE "documents" ADD COLUMN "dateRelecture" TIMESTAMP(3);
ALTER TABLE "documents" ADD COLUMN "circuitValidation" JSONB;

-- CreateTable : fil de discussion par dossier
CREATE TABLE "commentaires_dossier" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "auteurId" TEXT NOT NULL,
    "auteurNom" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'commentaire',
    "luPar" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commentaires_dossier_pkey" PRIMARY KEY ("id")
);

-- CreateTable : matrice RACI
CREATE TABLE "dossier_collaborateurs" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleRACI" TEXT NOT NULL,
    "discipline" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dossier_collaborateurs_pkey" PRIMARY KEY ("id")
);

-- CreateTable : check-list de clôture
CREATE TABLE "checklist_cloture" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "coche" BOOLEAN NOT NULL DEFAULT false,
    "cochePar" TEXT,
    "cocheLe" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checklist_cloture_pkey" PRIMARY KEY ("id")
);

-- CreateTable : notifications / rappels
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "dossierId" TEXT,
    "type" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severite" TEXT NOT NULL DEFAULT 'info',
    "lu" BOOLEAN NOT NULL DEFAULT false,
    "luLe" TIMESTAMP(3),
    "dateDeclenchement" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "commentaires_dossier_dossierId_idx" ON "commentaires_dossier"("dossierId");
CREATE INDEX "commentaires_dossier_createdAt_idx" ON "commentaires_dossier"("createdAt");

-- CreateIndex
CREATE INDEX "dossier_collaborateurs_dossierId_idx" ON "dossier_collaborateurs"("dossierId");

-- CreateIndex
CREATE INDEX "checklist_cloture_dossierId_idx" ON "checklist_cloture"("dossierId");

-- CreateIndex
CREATE INDEX "notifications_userId_lu_idx" ON "notifications"("userId", "lu");
CREATE INDEX "notifications_dossierId_idx" ON "notifications"("dossierId");

-- AddForeignKey
ALTER TABLE "commentaires_dossier" ADD CONSTRAINT "commentaires_dossier_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "dossiers"("id") ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE "dossier_collaborateurs" ADD CONSTRAINT "dossier_collaborateurs_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "dossiers"("id") ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_cloture" ADD CONSTRAINT "checklist_cloture_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "dossiers"("id") ON DELETE CASCADE;
