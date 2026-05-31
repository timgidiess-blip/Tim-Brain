-- =============================================================================
-- 0001_init_safe.sql
-- Safe version of the init migration — skips memory_chunks which was already
-- created by memory_chunks.sql. Run this in the Supabase SQL editor.
-- =============================================================================

-- ── Extensions ────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS vector;

-- ── Helpers ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ── Tables ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS entities (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT        NOT NULL,
  name        TEXT        NOT NULL,
  kind        TEXT        NOT NULL,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS raw_captures (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        TEXT        NOT NULL,
  source         TEXT        NOT NULL,
  raw_text       TEXT,
  audio_url      TEXT,
  classification JSONB,
  llm_source     TEXT,
  routed_to      TEXT,
  routed_id      UUID,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           TEXT        NOT NULL,
  title             TEXT        NOT NULL,
  description       TEXT,
  urgency           TEXT,
  key               BOOLEAN     NOT NULL DEFAULT FALSE,
  priority_score    NUMERIC,
  time_estimate_min INTEGER,
  tags              TEXT[],
  due_date          TIMESTAMPTZ,
  owner             TEXT,
  entity_id         UUID        REFERENCES entities (id) ON DELETE SET NULL,
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT        NOT NULL,
  log_date    DATE        NOT NULL,
  notes       TEXT,
  mood        SMALLINT    CHECK (mood BETWEEN 1 AND 10),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, log_date)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT,
  action        TEXT        NOT NULL,
  resource_type TEXT        NOT NULL,
  resource_id   UUID,
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Triggers ──────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS tasks_set_updated_at     ON tasks;
DROP TRIGGER IF EXISTS daily_logs_set_updated_at ON daily_logs;

CREATE TRIGGER tasks_set_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER daily_logs_set_updated_at
  BEFORE UPDATE ON daily_logs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS entities_user_id_idx     ON entities     (user_id);
CREATE INDEX IF NOT EXISTS raw_captures_user_id_idx ON raw_captures (user_id);
CREATE INDEX IF NOT EXISTS tasks_user_id_idx        ON tasks        (user_id);
CREATE INDEX IF NOT EXISTS daily_logs_user_id_idx   ON daily_logs   (user_id);
CREATE INDEX IF NOT EXISTS audit_log_user_id_idx    ON audit_log    (user_id);

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE entities     ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_captures ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_logs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log    ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "deny all" ON entities     USING (false) WITH CHECK (false);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "deny all" ON raw_captures USING (false) WITH CHECK (false);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "deny all" ON tasks        USING (false) WITH CHECK (false);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "deny all" ON daily_logs   USING (false) WITH CHECK (false);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "deny all" ON audit_log    USING (false) WITH CHECK (false);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
