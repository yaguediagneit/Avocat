DO $$
DECLARE
  s TEXT;
BEGIN
  FOR s IN
    SELECT nspname
    FROM pg_namespace
    WHERE nspname LIKE 'tenant_%' OR nspname = 'tenant_template'
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.missions_huissier ADD COLUMN IF NOT EXISTS "actif" BOOLEAN NOT NULL DEFAULT true',
      s
    );
    EXECUTE format(
      'ALTER TABLE %I.missions_architecte ADD COLUMN IF NOT EXISTS "actif" BOOLEAN NOT NULL DEFAULT true',
      s
    );
    EXECUTE format(
      'ALTER TABLE %I.missions_conseiller_juridique ADD COLUMN IF NOT EXISTS "actif" BOOLEAN NOT NULL DEFAULT true',
      s
    );
    EXECUTE format(
      'ALTER TABLE %I.missions_clerc ADD COLUMN IF NOT EXISTS "actif" BOOLEAN NOT NULL DEFAULT true',
      s
    );
  END LOOP;
END $$;
