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
    EXECUTE format($sql$
      CREATE TABLE IF NOT EXISTS %I.user_invitations (
        "id"          TEXT        NOT NULL,
        "user_id"     TEXT        NOT NULL,
        "token_hash"  TEXT        NOT NULL,
        "expires_at"  TIMESTAMP(3) NOT NULL,
        "used_at"     TIMESTAMP(3),
        "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "user_invitations_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "user_invitations_user_id_fkey" FOREIGN KEY ("user_id")
          REFERENCES %I."users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    $sql$, s, s);
    EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS user_invitations_token_hash_key ON %I.user_invitations (token_hash)', s);
    EXECUTE format('CREATE INDEX IF NOT EXISTS user_invitations_user_id_idx ON %I.user_invitations (user_id)', s);
  END LOOP;
END
$$;
