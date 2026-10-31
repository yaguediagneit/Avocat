-- Toutes les écritures existantes sont des écritures d'origine applicative :
-- elles sont marquées validées (le statut « brouillon » devient désormais une
-- suspension qui exclut l'écriture des états, sans la supprimer).
UPDATE "accounting_entries"
SET "is_validated" = true, "validated_at" = "created_at"
WHERE "is_validated" = false;
