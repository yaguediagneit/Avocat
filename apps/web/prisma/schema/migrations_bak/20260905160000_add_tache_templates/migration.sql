-- CreateTable
CREATE TABLE "tache_templates" (
    "id" TEXT NOT NULL,
    "specialiteId" TEXT NOT NULL,
    "workflowEtapeId" TEXT,
    "titre" TEXT NOT NULL,
    "description" TEXT,
    "delaiJours" INTEGER NOT NULL DEFAULT 0,
    "roleAttendu" TEXT NOT NULL DEFAULT 'any',
    "priorite" TEXT NOT NULL DEFAULT 'moyenne',
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tache_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tache_templates_specialiteId_idx" ON "tache_templates"("specialiteId");

-- CreateIndex
CREATE INDEX "tache_templates_workflowEtapeId_idx" ON "tache_templates"("workflowEtapeId");

-- AddForeignKey
ALTER TABLE "tache_templates" ADD CONSTRAINT "tache_templates_specialiteId_fkey" FOREIGN KEY ("specialiteId") REFERENCES "specialites"("id") ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE "tache_templates" ADD CONSTRAINT "tache_templates_workflowEtapeId_fkey" FOREIGN KEY ("workflowEtapeId") REFERENCES "workflow_specialite"("id") ON DELETE SET NULL;
