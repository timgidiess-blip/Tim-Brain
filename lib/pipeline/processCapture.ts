import OpenAI from "openai";
import { classifyCapture } from "@/lib/router/classifyCapture";
import { getDb, type DB } from "@/lib/supabase";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CaptureInput {
  rawText:  string;
  userId:   string;
  source:   string;             // 'telegram' | 'dashboard' | …
  audioUrl?: string | null;
}

export interface CaptureResult {
  captureId:  string;
  kind:       string;
  urgency:    string;
  summary:    string;
  tags:       string[];
  llmSource:  "claude" | "openai" | "regex";
  routedTo:   string | null;
  routedId:   string | null;
}

async function embedText(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");
  const openai = new OpenAI({ apiKey });
  const res = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  const embedding = res.data[0]?.embedding;
  if (!embedding) throw new Error("No embedding returned");
  return embedding;
}

// ── Downstream routing ────────────────────────────────────────────────────────

async function routeDownstream(
  db:        DB,
  kind:      string,
  urgency:   string,
  tags:      string[],
  summary:   string,
  entityId:  string | null,
  captureId: string,
  userId:    string,
  rawText:   string,
): Promise<{ table: string; id: string } | null> {
  // tasks and reminders → tasks table
  if (kind === "task" || kind === "reminder") {
    const { data, error } = await db
      .from("tasks")
      .insert({
        user_id:     userId,
        title:       summary,
        description: rawText,
        urgency,
        key:         kind === "reminder" || urgency === "today",
        tags,
        entity_id:   entityId ?? null,
      })
      .select("id")
      .single();

    if (error || !data) {
      console.error("[pipeline] tasks insert:", error?.message);
      return null;
    }
    return { table: "tasks", id: data.id as string };
  }

  // notes and decisions → today's daily_log (notes JSON array)
  if (kind === "note" || kind === "decision") {
    const today = new Date().toISOString().slice(0, 10);
    const entry = {
      id:         captureId,
      kind,
      summary,
      tags,
      created_at: new Date().toISOString(),
    };

    const { data: existing } = await db
      .from("daily_logs")
      .select("id, notes")
      .eq("user_id", userId)
      .eq("log_date", today)
      .maybeSingle();

    if (existing) {
      let captures: unknown[] = [];
      try {
        const parsed = JSON.parse(
          (existing.notes as string | null) ?? "{}",
        ) as Record<string, unknown>;
        if (Array.isArray(parsed["captures"])) {
          captures = parsed["captures"] as unknown[];
        }
      } catch { /* leave as empty */ }
      captures.push(entry);

      await db
        .from("daily_logs")
        .update({ notes: JSON.stringify({ captures }) })
        .eq("id", existing.id as string);

      return { table: "daily_logs", id: existing.id as string };
    }

    const { data: newLog, error } = await db
      .from("daily_logs")
      .insert({
        user_id:  userId,
        log_date: today,
        notes:    JSON.stringify({ captures: [entry] }),
      })
      .select("id")
      .single();

    if (error || !newLog) {
      console.error("[pipeline] daily_logs insert:", error?.message);
      return null;
    }
    return { table: "daily_logs", id: newLog.id as string };
  }

  // habit and other kinds stay in raw_captures only
  return null;
}

// ── Main pipeline ─────────────────────────────────────────────────────────────

export async function processCapture(
  input: CaptureInput,
): Promise<CaptureResult> {
  const { rawText, userId, source, audioUrl = null } = input;

  // 1. Classify
  const { source: llmSource, ...classified } = await classifyCapture(rawText);
  const { kind, urgency, tags, summary, entity_id } = classified;

  const db = getDb();

  // 2. Write raw_capture
  const { data: capture, error: captureErr } = await db
    .from("raw_captures")
    .insert({
      user_id:        userId,
      source,
      raw_text:       rawText,
      audio_url:      audioUrl,
      classification: classified,
      llm_source:     llmSource,
      routed_to:      null,
      routed_id:      null,
    })
    .select("id")
    .single();

  if (captureErr || !capture) {
    throw new Error(
      `raw_captures insert failed: ${captureErr?.message ?? "no data"}`,
    );
  }
  const captureId = capture.id as string;

  // 3. Route to downstream table
  const routed = await routeDownstream(
    db, kind, urgency, tags, summary, entity_id ?? null,
    captureId, userId, rawText,
  );

  if (routed) {
    await db
      .from("raw_captures")
      .update({ routed_to: routed.table, routed_id: routed.id })
      .eq("id", captureId);
  }

  // 4. Embed + write memory_chunk (non-fatal)
  try {
    const embedding = await embedText(rawText);
    await db.from("memory_chunks").insert({
      user_id:     userId,
      source_type: "raw_capture",
      source_id:   captureId,
      text:        rawText,
      embedding,
    });
  } catch (e) {
    console.warn("[pipeline] Embedding skipped:", (e as Error).message);
  }

  // 5. Audit log
  await db.from("audit_log").insert({
    user_id:       userId,
    action:        "capture_created",
    resource_type: "raw_captures",
    resource_id:   captureId,
    metadata: {
      kind,
      urgency,
      llm_source: llmSource,
      routed_to:  routed?.table ?? null,
      routed_id:  routed?.id   ?? null,
    },
  });

  return {
    captureId,
    kind,
    urgency,
    summary,
    tags,
    llmSource,
    routedTo:  routed?.table ?? null,
    routedId:  routed?.id   ?? null,
  };
}
