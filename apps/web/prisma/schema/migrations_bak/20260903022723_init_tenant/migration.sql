/*
  Warnings:

  - You are about to drop the `tenant_keys` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `tenants` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "tenant_keys" DROP CONSTRAINT "tenant_keys_tenantId_fkey";

-- DropTable
DROP TABLE "tenant_keys";

-- DropTable
DROP TABLE "tenants";

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "mfaSecret" TEXT,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "derniereConnexion" TIMESTAMP(3),
    "derniereIp" TEXT,
    "appareils" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "permissions" JSONB NOT NULL,
    "estAdmin" BOOLEAN NOT NULL DEFAULT false,
    "estClient" BOOLEAN NOT NULL DEFAULT false,
    "niveauConfidentialiteMax" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions_dossier" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "niveau" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_dossier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "raisonSociale" TEXT NOT NULL,
    "identifiant" TEXT,
    "adresse" TEXT,
    "coordonnees" JSONB,
    "representants" JSONB,
    "billingInfo" JSONB,
    "consentements" JSONB,
    "documentsAdmin" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dossiers" (
    "id" TEXT NOT NULL,
    "referenceInterne" TEXT NOT NULL,
    "typeAffaire" TEXT NOT NULL,
    "natureMission" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "partiesAdverses" JSONB,
    "juridictionId" TEXT,
    "avocatResponsableId" TEXT NOT NULL,
    "huissierResponsableId" TEXT,
    "collaborateurs" JSONB,
    "dateOuverture" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "niveauConfidentialite" INTEGER NOT NULL DEFAULT 1,
    "statut" TEXT NOT NULL DEFAULT 'Nouveau',
    "dateEcheance" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dossiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dossiers_immobiliers" (
    "dossierId" TEXT NOT NULL,
    "adresseBien" TEXT,
    "titreFoncier" TEXT,
    "natureBien" TEXT,
    "proprietaire" TEXT,
    "occupant" TEXT,
    "montantLitige" DOUBLE PRECISION,
    "expertId" TEXT,
    "notaireId" TEXT,
    "documentsPropriete" JSONB,

    CONSTRAINT "dossiers_immobiliers_pkey" PRIMARY KEY ("dossierId")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "categorie" TEXT NOT NULL,
    "s3KeyChiffre" TEXT NOT NULL,
    "hashSha256" TEXT NOT NULL,
    "taille" INTEGER NOT NULL,
    "versionCourante" INTEGER NOT NULL DEFAULT 1,
    "publieClient" BOOLEAN NOT NULL DEFAULT false,
    "datePublication" TIMESTAMP(3),
    "dateExpiration" TIMESTAMP(3),
    "creePar" TEXT NOT NULL,
    "validePar" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "versions_document" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "s3KeyChiffre" TEXT NOT NULL,
    "numeroVersion" INTEGER NOT NULL,
    "hashSha256" TEXT NOT NULL,
    "creePar" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "versions_document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "taches" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT,
    "responsableId" TEXT NOT NULL,
    "createurId" TEXT NOT NULL,
    "echeance" TIMESTAMP(3),
    "priorite" TEXT NOT NULL DEFAULT 'moyenne',
    "statut" TEXT NOT NULL DEFAULT 'En cours',
    "checklist" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "taches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evenements" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3),
    "lieu" TEXT,
    "participants" JSONB,
    "estPublicClient" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evenements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "missions_huissier" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "typeActe" TEXT NOT NULL,
    "huissierId" TEXT NOT NULL,
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

    CONSTRAINT "missions_huissier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "factures" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "dateEmission" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateEcheance" TIMESTAMP(3),
    "honoraires" JSONB,
    "debours" DOUBLE PRECISION,
    "frais" DOUBLE PRECISION,
    "totalTtc" DOUBLE PRECISION NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'Brouillon',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "factures_pkey" PRIMARY KEY ("id")
);

-- AddColumns
ALTER TABLE "factures" ADD COLUMN "libelle" TEXT;
ALTER TABLE "factures" ADD COLUMN "designation" TEXT;
ALTER TABLE "factures" ADD COLUMN "intervenants" JSONB;

-- CreateTable
CREATE TABLE "paiements" (
    "id" TEXT NOT NULL,
    "factureId" TEXT NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL,
    "datePaiement" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mode" TEXT NOT NULL,
    "reference" TEXT,
    "preuveKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "paiements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entite" TEXT NOT NULL,
    "entiteId" TEXT,
    "details" JSONB,
    "adresseIp" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "roles_nom_key" ON "roles"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "dossiers_referenceInterne_key" ON "dossiers"("referenceInterne");

-- CreateIndex
CREATE UNIQUE INDEX "factures_numero_key" ON "factures"("numero");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_entite_entiteId_idx" ON "audit_logs"("entite", "entiteId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossiers" ADD CONSTRAINT "dossiers_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "dossiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "versions_document" ADD CONSTRAINT "versions_document_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taches" ADD CONSTRAINT "taches_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "dossiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evenements" ADD CONSTRAINT "evenements_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "dossiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "missions_huissier" ADD CONSTRAINT "missions_huissier_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "dossiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "factures" ADD CONSTRAINT "factures_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "dossiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paiements" ADD CONSTRAINT "paiements_factureId_fkey" FOREIGN KEY ("factureId") REFERENCES "factures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
