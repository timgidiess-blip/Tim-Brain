-- =============================================================================
-- 0001_init.sql
-- Initial schema: entities, raw_captures, tasks, daily_logs,
--                 memory_chunks, audit_log
--
-- RLS: all tables locked down by default (deny-all permissive policy).
--      service_role holds BYPASSRLS and ignores these policies entirely.
--      Application policies (per-user SELECT/INSERT/UPDATE/DELETE) live
--      in subsequent migrations.
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
  user_id     UUID        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  kind        TEXT        NOT NULL,        -- e.g. 'person' | 'company' | 'project'
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Raw inputs from any capture surface before routing/processing.
CREATE TABLE raw_captures (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  source         TEXT        NOT NULL,     -- 'voice' | 'chat' | 'email' | 'webhook' …
  raw_text       TEXT,
  audio_url      TEXT,
  classification JSONB,                   -- LLM-assigned labels / intent / entities
  llm_source     TEXT,                    -- model that produced classification
  routed_to      TEXT,                    -- destination table, e.g. 'tasks'
  routed_id      UUID,                    -- PK of the row that was created/updated
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Action items, todos, projects.
CREATE TABLE tasks (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title             TEXT        NOT NULL,
  description       TEXT,
  urgency           TEXT,                  -- free-text or enum value (CRIT/HIGH/MED/LOW)
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
  user_id     UUID        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  log_date    DATE        NOT NULL,
  notes       TEXT,                        -- stores JSON blob for structured day data
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
  user_id     UUID        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  source_type TEXT        NOT NULL,        -- 'task' | 'daily_log' | 'entity' | 'capture' …
  source_id   UUID,                        -- FK to the originating row (loose reference)
  text        TEXT        NOT NULL,
  embedding   vector(1536),               -- text-embedding-3-small output dimension
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- IVFFlat ANN index — cosine distance.
-- lists = 100 is appropriate for up to ~1 M rows; revisit at scale
-- (rule of thumb: sqrt(row_count) lists, probe with SET ivfflat.probes).
CREATE INDEX memory_chunks_embedding_idx
  ON memory_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Immutable audit trail; user_id nullable to allow system-generated events.
CREATE TABLE audit_log (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        REFERENCES auth.users (id) ON DELETE SET NULL,
  action        TEXT        NOT NULL,      -- 'insert' | 'update' | 'delete' | custom verb
  resource_type TEXT        NOT NULL,      -- table name of the affected row
  resource_id   UUID,
  metadata      JSONB,                    -- diff, request context, etc.
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Row Level Security ────────────────────────────────────────────────────────
-- Enabling RLS with a permissive USING(false) policy guarantees that no row
-- is accessible or writable for any role that does not hold BYPASSRLS
-- (only service_role does in Supabase).  This is intentionally more explicit
-- than relying on "no policies = deny"; replace each policy with real
-- per-user logic in subsequent migrations as features are built.

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
