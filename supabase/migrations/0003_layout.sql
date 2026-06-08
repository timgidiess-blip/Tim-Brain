-- =============================================================================
-- 0003_layout.sql
-- Phase 0 — Foundation: per-user, per-section dashboard layout persistence,
-- plus the first additive columns on `tasks` that the new UI relies on.
--
-- Follows the 0001 conventions: user_id TEXT, RLS deny-all (service_role
-- bypasses), set_updated_at() trigger for mutable tables.
-- Idempotent where practical so it can be re-applied safely.
-- =============================================================================

-- ── Dashboard layouts ──────────────────────────────────────────────────────────
-- One row per (user, section). `layout` is the persisted widget arrangement:
--   [{ "widgetId": "today-tasks", "visible": true, "order": 0, "colSpan": 2 }, …]
-- Sections include the seven tabs plus 'rollup'. Defaults are synthesised from
-- the widget registry when no row exists, so this table only stores overrides.
CREATE TABLE IF NOT EXISTS dashboard_layouts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT        NOT NULL,
  section     TEXT        NOT NULL,
  layout      JSONB       NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, section)
);

CREATE INDEX IF NOT EXISTS dashboard_layouts_user_id_idx
  ON dashboard_layouts (user_id);

DROP TRIGGER IF EXISTS dashboard_layouts_set_updated_at ON dashboard_layouts;
CREATE TRIGGER dashboard_layouts_set_updated_at
  BEFORE UPDATE ON dashboard_layouts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE dashboard_layouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deny all" ON dashboard_layouts;
CREATE POLICY "deny all" ON dashboard_layouts USING (false) WITH CHECK (false);

-- ── Tasks: additive columns for the rebuilt Tasks section ───────────────────────
-- status mirrors completed_at (kept) but allows an 'archived' state; sort_order
-- backs the drag-reorderable priority list. project_id / recurrence_id are added
-- in 0003_tasks.sql once those tables exist (Phase 1).
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS status     TEXT    NOT NULL DEFAULT 'open';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sort_order INTEGER;
