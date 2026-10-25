-- CreateTable
CREATE TABLE "missions_architecte" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "typeActe" TEXT NOT NULL,
    "architecteId" TEXT NOT NULL,
    "adresseSignification" TEXT,
    "destinataire" TEXT,
    "datePrevue" TIMESTAMP(3),
    "fraisDeplacement" DOUBLE PRECISION,
    "debours" DOUBLE PRECISION,
    "dateTentative" TIMESTAMP(3),
    "dateRemise" TIMESTAMP(3),
    "resultat" TEXT,
    "preuveRemiseKey" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'En préparation',
    "retourKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "missions_architecte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "missions_conseiller_juridique" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "typeActe" TEXT NOT NULL,
    "conseillerJuridiqueId" TEXT NOT NULL,
    "adresseSignification" TEXT,
    "destinataire" TEXT,
    "datePrevue" TIMESTAMP(3),
    "fraisDeplacement" DOUBLE PRECISION,
    "debours" DOUBLE PRECISION,
    "dateTentative" TIMESTAMP(3),
    "dateRemise" TIMESTAMP(3),
    "resultat" TEXT,
    "preuveRemiseKey" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'En préparation',
    "retourKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "missions_conseiller_juridique_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "missions_clerc" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "typeActe" TEXT NOT NULL,
    "clercId" TEXT NOT NULL,
    "adresseSignification" TEXT,
    "destinataire" TEXT,
    "datePrevue" TIMESTAMP(3),
    "fraisDeplacement" DOUBLE PRECISION,
    "debours" DOUBLE PRECISION,
    "dateTentative" TIMESTAMP(3),
    "dateRemise" TIMESTAMP(3),
    "resultat" TEXT,
    "preuveRemiseKey" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'En préparation',
    "retourKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "missions_clerc_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "missions_architecte" ADD CONSTRAINT "missions_architecte_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "dossiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "missions_conseiller_juridique" ADD CONSTRAINT "missions_conseiller_juridique_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "dossiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "missions_clerc" ADD CONSTRAINT "missions_clerc_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "dossiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
