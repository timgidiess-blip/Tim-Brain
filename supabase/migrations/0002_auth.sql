-- =============================================================================
-- 0002_auth.sql
-- Browser auth: changeable PIN + WebAuthn passkeys (Face ID / Touch ID).
--
-- Replaces the env-var DASHBOARD_PASSWORD browser login with a PIN whose hash
-- lives in the database (so it can be changed from the UI), and adds a table
-- for platform-authenticator credentials (passkeys).
--
-- user_id is TEXT (single-owner model, same as 0001). RLS deny-all; the app
-- uses the service_role key, which bypasses RLS.
-- =============================================================================

-- ── Singleton auth config (the PIN) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auth_config (
  id         INTEGER     PRIMARY KEY DEFAULT 1,
  user_id    TEXT        NOT NULL,
  pin_hash   TEXT        NOT NULL,          -- pbkdf2$<iter>$<salt>$<hash> (base64url)
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT auth_config_singleton CHECK (id = 1)
);

-- ── Passkeys / platform authenticators ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS webauthn_credentials (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT        NOT NULL,
  credential_id TEXT        NOT NULL UNIQUE,   -- base64url
  public_key    TEXT        NOT NULL,          -- base64url(COSE public key)
  counter       BIGINT      NOT NULL DEFAULT 0,
  transports    TEXT[],
  device_label  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS webauthn_credentials_user_id_idx
  ON webauthn_credentials (user_id);

-- ── Row Level Security (deny-all; service_role bypasses) ──────────────────────
ALTER TABLE auth_config          ENABLE ROW LEVEL SECURITY;
ALTER TABLE webauthn_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deny all" ON auth_config;
DROP POLICY IF EXISTS "deny all" ON webauthn_credentials;
CREATE POLICY "deny all" ON auth_config          USING (false) WITH CHECK (false);
CREATE POLICY "deny all" ON webauthn_credentials USING (false) WITH CHECK (false);
