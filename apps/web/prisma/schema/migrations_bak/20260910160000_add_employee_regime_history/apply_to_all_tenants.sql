DO $$
DECLARE
  s TEXT;
BEGIN
  FOR s IN
    SELECT nspname
    FROM pg_namespace
    WHERE nspname LIKE 'tenant_%' OR nspname = 'tenant_template'
  LOOP
    -- Ajoute la colonne regime sur employees si absente
    EXECUTE format(
      'ALTER TABLE %I.employees ADD COLUMN IF NOT EXISTS "regime" TEXT NOT NULL DEFAULT ''general''',
      s
    );

    -- Crée la table d historique si absente
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I.employee_history (
        "id" TEXT NOT NULL,
        "employee_id" TEXT NOT NULL,
        "field" TEXT NOT NULL,
        "old_value" TEXT,
        "new_value" TEXT,
        "changed_by" TEXT,
        "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "employee_history_pkey" PRIMARY KEY ("id")
      )',
      s
    );

    -- Index
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS "employee_history_employee_id_field_changed_at_idx" ON %I.employee_history("employee_id", "field", "changed_at")',
      s
    );

    -- Foreign key
    EXECUTE format(
      'ALTER TABLE IF EXISTS %I.employee_history DROP CONSTRAINT IF EXISTS "employee_history_employee_id_fkey"',
      s
    );
    EXECUTE format(
      'ALTER TABLE %I.employee_history ADD CONSTRAINT "employee_history_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES %I.employees("id") ON DELETE CASCADE ON UPDATE CASCADE',
      s, s
    );
  END LOOP;
END $$;
