CREATE TABLE "user_invitations" (
  "id"          TEXT        NOT NULL,
  "user_id"     TEXT        NOT NULL,
  "token_hash"  TEXT        NOT NULL,
  "expires_at"  TIMESTAMP(3) NOT NULL,
  "used_at"     TIMESTAMP(3),
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_invitations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_invitations_user_id_fkey" FOREIGN KEY ("user_id")
    REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "user_invitations_token_hash_key" ON "user_invitations" ("token_hash");
CREATE INDEX "user_invitations_user_id_idx" ON "user_invitations" ("user_id");
