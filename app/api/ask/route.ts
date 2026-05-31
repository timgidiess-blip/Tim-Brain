/**
 * POST /api/ask
 * Body: { query: string, limit?: number }
 *
 * 1. Embeds the user's question
 * 2. Pulls top 20 memory_chunks by cosine similarity
 * 3. Joins source rows for full context (tasks batch-fetched)
 * 4. Sends question + truncated context to Claude (claude-sonnet-4-5)
 * 5. Streams the answer back as Server-Sent Events:
 *      data: {"type":"text","delta":"..."}
 *      data: {"type":"sources","chunks":[...]}
 *      data: {"type":"done"}
 *      data: {"type":"error","message":"..."}
 */
import { type NextRequest } from "next/server";
import Anthropic             from "@anthropic-ai/sdk";
import { embed }             from "@/lib/embed";
import { getDb }             from "@/lib/supabase";
import type { MemoryChunk }  from "@/app/api/memory/search/route";

// 200 tokens ≈ 800 characters (English ~4 chars/token)
const MAX_CHUNK_CHARS = 800;

const SYSTEM_PROMPT =
  `You are the user's personal assistant. Answer the question using ONLY the context provided. \
Cite sources by referring to source IDs in [brackets]. If you don't have enough context, say so.`;

// ── SSE helpers ────────────────────────────────────────────────────────────────

const encoder = new TextEncoder();

function sseEncode(data: object): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
}

/** Single-event SSE response (for pre-stream errors / guard returns). */
function sseError(message: string): Response {
  return new Response(
    `data: ${JSON.stringify({ type: "error", message })}\n\n`,
    { headers: sseHeaders() },
  );
}

// ── Build context string from chunks ──────────────────────────────────────────

function buildContext(chunks: MemoryChunk[]): string {
  return chunks
    .map((c, i) => {
      const truncated = c.text.length > MAX_CHUNK_CHARS
        ? c.text.slice(0, MAX_CHUNK_CHARS) + "…"
        : c.text;
      const pct     = (c.similarity * 100).toFixed(0);
      const srcId   = `${c.source_type}:${c.source_id}`;
      const taskInfo =
        c.source_type === "task" && c.source_row
          ? ` | title: "${String(c.source_row["title"] ?? "")}" | urgency: ${String(c.source_row["urgency"] ?? "—")} | status: ${c.source_row["completed_at"] ? "completed" : "open"}`
          : "";
      return `${i + 1}. [${srcId}] (${c.source_type}, ${pct}% match${taskInfo})\n${truncated}`;
    })
    .join("\n\n");
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<Response> {
  const userId = process.env.TELEGRAM_USER_ID;
  if (!userId) return sseError("Server not configured");

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) return sseError("ANTHROPIC_API_KEY not set");

  if (!process.env.OPENAI_API_KEY) return sseError("OPENAI_API_KEY not set — needed for embedding");

  let body: { query?: string; limit?: number };
  try { body = await req.json() as typeof body; }
  catch { return sseError("Invalid JSON"); }

  const query = body.query?.trim();
  if (!query) return sseError("query required");

  const limit = Math.min(50, Math.max(1, body.limit ?? 20));

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (data: object) => controller.enqueue(sseEncode(data));

      try {
        // ── 1. Embed query ───────────────────────────────────────────────────
        const queryEmbedding = await embed(query);

        // ── 2. Vector search ─────────────────────────────────────────────────
        const db = getDb();
        const { data: chunks, error } = await db.rpc("match_memory_chunks", {
          query_embedding: queryEmbedding,
          match_count:     limit,
          p_user_id:       userId,
        });

        if (error) {
          if (
            error.message.includes("does not exist") ||
            error.code === "42883" ||
            error.code === "42P01"
          ) {
            send({
              type:    "error",
              message: "Memory table not set up yet. Run supabase/memory_chunks.sql to enable /ask.",
            });
            controller.close();
            return;
          }
          throw new Error(error.message);
        }

        const results = (chunks ?? []) as MemoryChunk[];

        // ── 3. Join source rows (tasks) ───────────────────────────────────────
        const taskIds = results
          .filter(c => c.source_type === "task")
          .map(c => c.source_id);

        const taskMap = new Map<string, Record<string, unknown>>();
        if (taskIds.length > 0) {
          const { data: tasks } = await db
            .from("tasks")
            .select("id, title, description, urgency, key, tags, due_date, completed_at")
            .in("id", taskIds);
          for (const t of tasks ?? []) taskMap.set(t.id as string, t as Record<string, unknown>);
        }

        const enriched: MemoryChunk[] = results.map(c => ({
          ...c,
          source_row: c.source_type === "task" ? (taskMap.get(c.source_id) ?? null) : null,
        }));

        // ── 4. Build context & call Claude (streaming) ────────────────────────
        const context = buildContext(enriched);

        if (!context.trim()) {
          send({ type: "text", delta: "I don't have any relevant memories yet to answer that question. Add some captures, tasks, or habits first." });
          send({ type: "sources", chunks: [] });
          send({ type: "done" });
          controller.close();
          return;
        }

        const userContent =
          `<context>\n${context}\n</context>\n\n<question>${query}</question>`;

        const anthropic  = new Anthropic({ apiKey: anthropicKey });
        const claudeStream = await anthropic.messages.create({
          model:      "claude-sonnet-4-5",
          max_tokens: 1024,
          stream:     true,
          system:     SYSTEM_PROMPT,
          messages:   [{ role: "user", content: userContent }],
        });

        // ── 5. Stream text deltas ─────────────────────────────────────────────
        for await (const event of claudeStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta" &&
            event.delta.text
          ) {
            send({ type: "text", delta: event.delta.text });
          }
        }

        // ── 6. Send sources + done ────────────────────────────────────────────
        send({ type: "sources", chunks: enriched });
        send({ type: "done" });

      } catch (err) {
        console.error("[api/ask]", err);
        send({ type: "error", message: (err as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: sseHeaders() });
}

function sseHeaders(): HeadersInit {
  return {
    "Content-Type":  "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection":    "keep-alive",
    "X-Accel-Buffering": "no",   // disable nginx buffering if behind proxy
  };
}
