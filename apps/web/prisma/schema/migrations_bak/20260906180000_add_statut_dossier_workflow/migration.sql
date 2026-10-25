-- AlterTable : ajout du champ "statutDossier" sur les etapes de workflow des specialites
-- Permet de definir le statut du dossier a appliquer quand une mission d'huissier realise cette etape.
ALTER TABLE "workflow_specialite" ADD COLUMN "statutDossier" TEXT;
