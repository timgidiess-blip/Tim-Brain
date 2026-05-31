-- Run this in the Supabase SQL editor:
-- https://supabase.com/dashboard/project/ygcsmapamdgxiwxmbjia/sql/new

-- 1. Enable pgvector (usually already on for Supabase projects)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. memory_chunks table
CREATE TABLE IF NOT EXISTS memory_chunks (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     text        NOT NULL,
  source_type text        NOT NULL,   -- 'capture' | 'task' | 'habit' | 'meal' | 'goal'
  source_id   text        NOT NULL,   -- original row id (or composite like "date:mealId")
  text        text        NOT NULL,   -- canonical searchable text
  embedding   vector(1536),           -- text-embedding-3-small
  metadata    jsonb       DEFAULT '{}',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- 3. One chunk per (user, source_type, source_id) — upserts work cleanly
CREATE UNIQUE INDEX IF NOT EXISTS memory_chunks_source_uidx
  ON memory_chunks (user_id, source_type, source_id);

-- 4. IVFFlat cosine index — good for ~100 K rows; rebuild with higher lists if needed
CREATE INDEX IF NOT EXISTS memory_chunks_embedding_idx
  ON memory_chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- 5. Stored function for cosine similarity search
--    Called by the API via: supabase.rpc('match_memory_chunks', { ... })
CREATE OR REPLACE FUNCTION match_memory_chunks(
  query_embedding  vector(1536),
  match_count      int,
  p_user_id        text
)
RETURNS TABLE (
  id          uuid,
  user_id     text,
  source_type text,
  source_id   text,
  text        text,
  metadata    jsonb,
  created_at  timestamptz,
  similarity  float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    mc.id,
    mc.user_id,
    mc.source_type,
    mc.source_id,
    mc.text,
    mc.metadata,
    mc.created_at,
    1 - (mc.embedding <=> query_embedding) AS similarity
  FROM memory_chunks mc
  WHERE mc.user_id = p_user_id
    AND mc.embedding IS NOT NULL
  ORDER BY mc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
