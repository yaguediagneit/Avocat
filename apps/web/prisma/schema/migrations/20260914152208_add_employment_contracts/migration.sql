-- CreateTable
CREATE TABLE "employment_contracts" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "type_contrat" TEXT NOT NULL,
    "date_debut" DATE NOT NULL,
    "date_fin" DATE,
    "duree_mois" INTEGER,
    "fonction" TEXT,
    "service" TEXT,
    "lieu_travail" TEXT,
    "horaires" TEXT,
    "salaire_base" INTEGER NOT NULL,
    "periode_essai_jours" INTEGER,
    "conges_payes_annuel" INTEGER NOT NULL DEFAULT 0,
    "convention_collective" TEXT,
    "clause_confidentialite" BOOLEAN NOT NULL DEFAULT false,
    "clause_non_concurrence" BOOLEAN NOT NULL DEFAULT false,
    "objet" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'brouillon',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employment_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employment_contracts_employee_id_idx" ON "employment_contracts"("employee_id");

-- CreateIndex
CREATE INDEX "employment_contracts_statut_idx" ON "employment_contracts"("statut");

-- AddForeignKey
ALTER TABLE "employment_contracts" ADD CONSTRAINT "employment_contracts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
