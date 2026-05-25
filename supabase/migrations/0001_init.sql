-- =============================================================================
-- 0001_init.sql
-- Initial schema: entities, raw_captures, tasks, daily_logs,
--                 memory_chunks, audit_log
--
-- user_id is stored as TEXT (Telegram user ID, dashboard owner ID, etc.).
-- No FK to auth.users — this is a single-owner dashboard; Supabase Auth is
-- not used for the primary session layer. Swap to UUID + FK in a later
-- migration if multi-user auth is added.
--
-- RLS: all tables locked down by default (deny-all permissive policy).
--      service_role holds BYPASSRLS and ignores these policies entirely.
-- =============================================================================

-- ── Extensions ────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS vector;           -- pgvector: vector type + IVFFlat

-- ── Helpers ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ── Tables ────────────────────────────────────────────────────────────────────

-- People, companies, projects, accounts — anything worth remembering.
CREATE TABLE entities (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT        NOT NULL,
  name        TEXT        NOT NULL,
  kind        TEXT        NOT NULL,        -- e.g. 'person' | 'company' | 'project'
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Raw inputs from any capture surface before routing/processing.
CREATE TABLE raw_captures (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        TEXT        NOT NULL,
  source         TEXT        NOT NULL,     -- 'telegram' | 'voice' | 'email' …
  raw_text       TEXT,
  audio_url      TEXT,
  classification JSONB,                   -- LLM-assigned labels / intent / entities
  llm_source     TEXT,                    -- 'claude' | 'openai' | 'regex'
  routed_to      TEXT,                    -- destination table, e.g. 'tasks'
  routed_id      UUID,                    -- PK of the row created/updated
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Action items, todos, projects.
CREATE TABLE tasks (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           TEXT        NOT NULL,
  title             TEXT        NOT NULL,
  description       TEXT,
  urgency           TEXT,                  -- 'today' | 'this_week' | 'this_month' | 'someday'
  key               BOOLEAN     NOT NULL DEFAULT FALSE,
  priority_score    NUMERIC,               -- computed score, higher = more urgent
  time_estimate_min INTEGER,               -- estimated effort in minutes
  tags              TEXT[],
  due_date          TIMESTAMPTZ,
  owner             TEXT,
  entity_id         UUID        REFERENCES entities (id) ON DELETE SET NULL,
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER tasks_set_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- One log entry per user per calendar day (habits, nutrition, finance, goals).
CREATE TABLE daily_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT        NOT NULL,
  log_date    DATE        NOT NULL,
  notes       TEXT,                        -- JSON blob for structured day data
  mood        SMALLINT    CHECK (mood BETWEEN 1 AND 10),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, log_date)               -- at most one log per user per day
);

CREATE TRIGGER daily_logs_set_updated_at
  BEFORE UPDATE ON daily_logs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Vector store for semantic search across all content types.
CREATE TABLE memory_chunks (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT        NOT NULL,
  source_type TEXT        NOT NULL,        -- 'raw_capture' | 'task' | 'daily_log' …
  source_id   UUID,                        -- loose FK to the originating row
  text        TEXT        NOT NULL,
  embedding   vector(1536),               -- text-embedding-3-small output dimension
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- IVFFlat ANN index — cosine distance.
-- lists = 100 suits up to ~1 M rows; revisit at scale.
CREATE INDEX memory_chunks_embedding_idx
  ON memory_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Immutable audit trail.
CREATE TABLE audit_log (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT,
  action        TEXT        NOT NULL,
  resource_type TEXT        NOT NULL,
  resource_id   UUID,
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX entities_user_id_idx      ON entities      (user_id);
CREATE INDEX raw_captures_user_id_idx  ON raw_captures  (user_id);
CREATE INDEX tasks_user_id_idx         ON tasks         (user_id);
CREATE INDEX daily_logs_user_id_idx    ON daily_logs    (user_id);
CREATE INDEX memory_chunks_user_id_idx ON memory_chunks (user_id);
CREATE INDEX audit_log_user_id_idx     ON audit_log     (user_id);

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE entities      ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_captures  ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_logs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deny all" ON entities      USING (false) WITH CHECK (false);
CREATE POLICY "deny all" ON raw_captures  USING (false) WITH CHECK (false);
CREATE POLICY "deny all" ON tasks         USING (false) WITH CHECK (false);
CREATE POLICY "deny all" ON daily_logs    USING (false) WITH CHECK (false);
CREATE POLICY "deny all" ON memory_chunks USING (false) WITH CHECK (false);
CREATE POLICY "deny all" ON audit_log     USING (false) WITH CHECK (false);
