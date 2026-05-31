-- user_settings: key/value store for per-user config (e.g. pin_hash)
CREATE TABLE IF NOT EXISTS user_settings (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT        NOT NULL,
  key        TEXT        NOT NULL,
  value      TEXT        NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, key)
);

-- webauthn_credentials: passkeys registered for Touch ID / Face ID
CREATE TABLE IF NOT EXISTS webauthn_credentials (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          TEXT        NOT NULL,
  credential_id    TEXT        NOT NULL UNIQUE,
  public_key       TEXT        NOT NULL,
  counter          BIGINT      NOT NULL DEFAULT 0,
  device_type      TEXT,
  backed_up        BOOLEAN     NOT NULL DEFAULT FALSE,
  transports       TEXT[],
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS user_settings_user_key_idx        ON user_settings        (user_id, key);
CREATE INDEX IF NOT EXISTS webauthn_credentials_user_id_idx  ON webauthn_credentials (user_id);
CREATE INDEX IF NOT EXISTS webauthn_cred_id_idx              ON webauthn_credentials (credential_id);

ALTER TABLE user_settings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE webauthn_credentials ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "deny all" ON user_settings        USING (false) WITH CHECK (false);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "deny all" ON webauthn_credentials USING (false) WITH CHECK (false);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
