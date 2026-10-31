DO $$
DECLARE
  s text;
BEGIN
  FOR s IN
    SELECT schema_name
    FROM information_schema.schemata
    WHERE schema_name LIKE 'tenant_%'
      AND schema_name <> 'tenant_cjm'
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.users ADD COLUMN IF NOT EXISTS password_change_required boolean NOT NULL DEFAULT false',
      s
    );
  END LOOP;
END
$$;
