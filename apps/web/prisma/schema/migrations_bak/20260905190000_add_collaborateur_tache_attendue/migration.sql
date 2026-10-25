-- AlterTable : ajout du champ "tacheAttendue" sur les collaborateurs RACI d'un dossier
-- Permet de décrire le travail ou la tâche attendue pour chaque associé/intervenant.
ALTER TABLE "dossier_collaborateurs" ADD COLUMN "tacheAttendue" TEXT;
