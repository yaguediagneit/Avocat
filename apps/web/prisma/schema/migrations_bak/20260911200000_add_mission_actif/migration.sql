-- AlterTable: ajout du champ actif aux missions (huissier, architecte, conseiller juridique, clerc)
ALTER TABLE "missions_huissier" ADD COLUMN "actif" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "missions_architecte" ADD COLUMN "actif" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "missions_conseiller_juridique" ADD COLUMN "actif" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "missions_clerc" ADD COLUMN "actif" BOOLEAN NOT NULL DEFAULT true;
