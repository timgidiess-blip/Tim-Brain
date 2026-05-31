import OpenAI from "openai";
import { classifyCapture, type CaptureUrgency } from "@/lib/router/classifyCapture";
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

// ── Urgency override (Telegram inline-button callback) ──────────────────────────

export interface UrgencyOverrideInput {
  captureId: string;
  userId:    string;
  urgency?:  CaptureUrgency;   // set the task's urgency
  key?:      boolean;          // flag the task as "key"
}

export interface UrgencyOverrideResult {
  ok:       boolean;
  routedTo: string | null;     // 'tasks' when a task was updated
  title:    string | null;     // task title, for the confirmation message
  reason?:  string;            // why the override could not be applied
}

/**
 * Applies an urgency / key override that the user selected from the Telegram
 * inline keyboard. The button's callback carries the originating raw_capture id,
 * so we resolve it to the downstream task it was routed to and patch that task.
 *
 * Returns gracefully (ok:false) when the capture was not routed to a task
 * (e.g. notes / decisions), so the caller can surface a friendly message.
 */
export async function applyUrgencyOverride(
  input: UrgencyOverrideInput,
): Promise<UrgencyOverrideResult> {
  const { captureId, userId, urgency, key } = input;
  const db = getDb();

  // 1. Resolve the capture → downstream row it was routed to.
  const { data: capture, error: capErr } = await db
    .from("raw_captures")
    .select("id, routed_to, routed_id, classification")
    .eq("id", captureId)
    .eq("user_id", userId)
    .maybeSingle();

  if (capErr || !capture) {
    return { ok: false, routedTo: null, title: null, reason: "capture_not_found" };
  }

  const routedTo = (capture.routed_to as string | null) ?? null;
  const routedId = (capture.routed_id as string | null) ?? null;

  // 2. Keep the capture's stored classification in sync (best-effort).
  if (urgency) {
    const classification =
      capture.classification && typeof capture.classification === "object"
        ? (capture.classification as Record<string, unknown>)
        : {};
    await db
      .from("raw_captures")
      .update({ classification: { ...classification, urgency } })
      .eq("id", captureId)
      .eq("user_id", userId);
  }

  // 3. Only tasks carry an urgency / key flag.
  if (routedTo !== "tasks" || !routedId) {
    return { ok: false, routedTo, title: null, reason: "not_a_task" };
  }

  const patch: Record<string, unknown> = {};
  if (urgency)            patch.urgency = urgency;
  if (typeof key === "boolean") patch.key = key;
  if (Object.keys(patch).length === 0) {
    return { ok: false, routedTo, title: null, reason: "no_change" };
  }

  const { data: task, error: taskErr } = await db
    .from("tasks")
    .update(patch)
    .eq("id", routedId)
    .eq("user_id", userId)
    .select("title")
    .single();

  if (taskErr || !task) {
    console.error("[pipeline] urgency override task update:", taskErr?.message);
    return { ok: false, routedTo, title: null, reason: "task_update_failed" };
  }

  // 4. Audit the override.
  await db.from("audit_log").insert({
    user_id:       userId,
    action:        "urgency_override",
    resource_type: "tasks",
    resource_id:   routedId,
    metadata:      { capture_id: captureId, urgency: urgency ?? null, key: key ?? null },
  });

  return { ok: true, routedTo, title: (task.title as string) ?? null };
}
