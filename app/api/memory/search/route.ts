/**
 * POST /api/memory/search
 * Body: { query: string, limit?: number }
 *
 * 1. Embeds the query with text-embedding-3-small
 * 2. Calls match_memory_chunks() Postgres function (cosine similarity, IVFFlat)
 * 3. For task chunks, batch-fetches the original task rows and attaches them
 * 4. Returns up to `limit` (default 20) results ordered by similarity desc
 */
import { type NextRequest, NextResponse } from "next/server";
import { embed } from "@/lib/embed";
import { getDb } from "@/lib/supabase";

export interface MemoryChunk {
  id:          string;
  source_type: string;
  source_id:   string;
  text:        string;
  metadata:    Record<string, unknown>;
  created_at:  string;
  similarity:  number;
  source_row?: Record<string, unknown> | null;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const userId = process.env.TELEGRAM_USER_ID;
  if (!userId) return NextResponse.json({ error: "Not configured" }, { status: 500 });

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY not set" }, { status: 503 });
  }

  let body: { query?: string; limit?: number };
  try { body = await req.json() as typeof body; }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const query = body.query?.trim();
  if (!query) return NextResponse.json({ error: "query required" }, { status: 422 });

  const limit = Math.min(50, Math.max(1, body.limit ?? 20));

  try {
    // 1. Embed the query
    const queryEmbedding = await embed(query);

    // 2. Vector search via stored function
    const db = getDb();
    const { data: chunks, error } = await db.rpc("match_memory_chunks", {
      query_embedding: queryEmbedding,
      match_count:     limit,
      p_user_id:       userId,
    });

    if (error) {
      // Graceful degradation: if the table/function doesn't exist yet
      if (error.message.includes("does not exist") || error.code === "42883" || error.code === "42P01") {
        return NextResponse.json({
          chunks: [],
          hint: "Run supabase/memory_chunks.sql in your Supabase SQL editor to enable semantic search.",
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const results = (chunks ?? []) as MemoryChunk[];

    // 3. Batch-fetch original task rows for task chunks
    const taskIds = results
      .filter(c => c.source_type === "task")
      .map(c => c.source_id)
      .filter(Boolean);

    const taskMap = new Map<string, Record<string, unknown>>();
    if (taskIds.length > 0) {
      const { data: tasks } = await db
        .from("tasks")
        .select("id, title, description, urgency, key, tags, due_date, completed_at, priority_score, entity_id")
        .in("id", taskIds);
      for (const t of tasks ?? []) taskMap.set(t.id as string, t as Record<string, unknown>);
    }

    // 4. Attach source rows
    const enriched: MemoryChunk[] = results.map(c => ({
      ...c,
      source_row: c.source_type === "task" ? (taskMap.get(c.source_id) ?? null) : null,
    }));

    return NextResponse.json({ chunks: enriched, query });
  } catch (err) {
    console.error("[api/memory/search]", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
