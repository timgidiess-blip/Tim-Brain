import { type NextRequest, NextResponse } from "next/server";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import OpenAI, { toFile } from "openai";
import {
  classifyCapture,
  type Classification,
} from "@/lib/router/classifyCapture";

// ── Telegram types ────────────────────────────────────────────────────────────

interface TgUser    { id: number; first_name: string }
interface TgChat    { id: number }
interface TgVoice   { file_id: string; duration: number; mime_type?: string }
interface TgMessage {
  message_id: number;
  from?:  TgUser;
  chat:   TgChat;
  text?:  string;
  voice?: TgVoice;
}
interface TgUpdate { update_id: number; message?: TgMessage }
interface TgFileResult { file_path: string }
interface TgResponse<T> { ok: boolean; result?: T }

// ── Supabase ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = SupabaseClient<any>;

function getDb(): DB {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars missing");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createClient<any>(url, key);
}

// ── Telegram helpers ──────────────────────────────────────────────────────────

function botToken(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error("TELEGRAM_BOT_TOKEN missing");
  return t;
}

async function tgFilePath(fileId: string): Promise<string> {
  const res  = await fetch(
    `https://api.telegram.org/bot${botToken()}/getFile?file_id=${encodeURIComponent(fileId)}`,
  );
  const json = (await res.json()) as TgResponse<TgFileResult>;
  if (!json.ok || !json.result?.file_path) throw new Error("Telegram getFile failed");
  return json.result.file_path;
}

async function tgDownload(filePath: string): Promise<Buffer> {
  const res = await fetch(
    `https://api.telegram.org/file/bot${botToken()}/${filePath}`,
  );
  if (!res.ok) throw new Error(`Telegram file download failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function tgSend(
  chatId: number,
  text: string,
  replyMarkup?: object,
): Promise<void> {
  await fetch(`https://api.telegram.org/bot${botToken()}/sendMessage`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id:      chatId,
      text,
      parse_mode:   "HTML",
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    }),
  });
}

function urgencyKeyboard(captureId: string): object {
  return {
    inline_keyboard: [
      [
        { text: "🔴 Today",      callback_data: `urg:today:${captureId}` },
        { text: "🟡 This Week",  callback_data: `urg:week:${captureId}` },
      ],
      [
        { text: "🔵 This Month", callback_data: `urg:month:${captureId}` },
        { text: "⚪ Someday",    callback_data: `urg:someday:${captureId}` },
        { text: "🔑 Key",        callback_data: `urg:key:${captureId}` },
      ],
    ],
  };
}

// ── OpenAI helpers ────────────────────────────────────────────────────────────

function getOpenAI(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY missing");
  return new OpenAI({ apiKey });
}

async function transcribeVoice(
  buffer: Buffer,
  mimeType = "audio/ogg",
): Promise<string> {
  const openai = getOpenAI();
  const ext    = mimeType.includes("ogg") ? "ogg" : mimeType.split("/")[1] ?? "mp3";
  const file   = await toFile(buffer, `voice.${ext}`, { type: mimeType });
  const result = await openai.audio.transcriptions.create({
    model: "whisper-1",
    file,
  });
  return result.text.trim();
}

async function embedText(text: string): Promise<number[]> {
  const openai = getOpenAI();
  const res    = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  const embedding = res.data[0]?.embedding;
  if (!embedding) throw new Error("No embedding returned");
  return embedding;
}

// ── Downstream routing ────────────────────────────────────────────────────────

async function routeDownstream(
  db:         DB,
  classified: Classification,
  captureId:  string,
  userId:     string,
  rawText:    string,
): Promise<{ table: string; id: string } | null> {
  const { kind, urgency, tags, summary, entity_id } = classified;

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
        entity_id:   entity_id ?? null,
      })
      .select("id")
      .single();

    if (error || !data) {
      console.error("[route] tasks insert:", error?.message);
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
        const parsed = JSON.parse((existing.notes as string | null) ?? "{}") as Record<string, unknown>;
        if (Array.isArray(parsed["captures"])) captures = parsed["captures"] as unknown[];
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
      console.error("[route] daily_logs insert:", error?.message);
      return null;
    }
    return { table: "daily_logs", id: newLog.id as string };
  }

  // habit and other kinds stay in raw_captures only
  return null;
}

// ── Reply formatting ──────────────────────────────────────────────────────────

const KIND_EMOJI: Record<string, string> = {
  task:     "📋",
  note:     "📝",
  decision: "⚖️",
  reminder: "⏰",
  habit:    "🔄",
};

const URGENCY_LABEL: Record<string, string> = {
  today:      "Today",
  this_week:  "This Week",
  this_month: "This Month",
  someday:    "Someday",
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildReply(
  classified: Classification,
  source: string,
): string {
  const kindEmoji    = KIND_EMOJI[classified.kind] ?? "📌";
  const urgencyLabel = URGENCY_LABEL[classified.urgency] ?? classified.urgency;
  const tagsLine     = classified.tags.length > 0
    ? `\n🏷 ${esc(classified.tags.map(t => `#${t}`).join(" "))}`
    : "";

  return (
    `✅ <b>Captured</b> · <code>${esc(source)}</code>\n` +
    `${kindEmoji} <b>${esc(classified.kind)}</b>  ·  ${urgencyLabel} (AI)` +
    tagsLine +
    `\n\n<i>${esc(classified.summary)}</i>\n\n` +
    `Override urgency ↓`
  );
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Verify webhook secret
  const secret   = req.headers.get("x-telegram-bot-api-secret-token");
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Parse body
  let update: TgUpdate;
  try {
    update = (await req.json()) as TgUpdate;
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const message = update.message;
  if (!message) return NextResponse.json({ ok: true }); // e.g. edited_message, callback_query

  const chatId = message.chat.id;

  // 2. Verify authorized user
  const allowedId = parseInt(process.env.TELEGRAM_USER_ID ?? "", 10);
  if (!allowedId || message.from?.id !== allowedId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const userId = String(message.from.id);

  try {
    // 3. Extract text (voice → Whisper, or plain text)
    let rawText:  string;
    let audioUrl: string | null = null;

    if (message.voice) {
      const filePath = await tgFilePath(message.voice.file_id);
      audioUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${filePath}`;
      const buffer = await tgDownload(filePath);
      rawText = await transcribeVoice(buffer, message.voice.mime_type);
    } else if (message.text) {
      rawText = message.text;
    } else {
      await tgSend(chatId, "Send me text or a voice message and I'll capture it. 🎙");
      return NextResponse.json({ ok: true });
    }

    if (!rawText.trim()) {
      await tgSend(chatId, "⚠️ Couldn't read that. Please try again.");
      return NextResponse.json({ ok: true });
    }

    // 4. Classify
    const { source, ...classified } = await classifyCapture(rawText);

    const db = getDb();

    // 5. Write raw_capture
    const { data: capture, error: captureErr } = await db
      .from("raw_captures")
      .insert({
        user_id:        userId,
        source:         "telegram",
        raw_text:       rawText,
        audio_url:      audioUrl,
        classification: classified,
        llm_source:     source,
        routed_to:      null,
        routed_id:      null,
      })
      .select("id")
      .single();

    if (captureErr || !capture) {
      throw new Error(`raw_captures insert failed: ${captureErr?.message ?? "no data"}`);
    }
    const captureId = capture.id as string;

    // 6. Route to downstream table
    const routed = await routeDownstream(db, classified, captureId, userId, rawText);
    if (routed) {
      await db
        .from("raw_captures")
        .update({ routed_to: routed.table, routed_id: routed.id })
        .eq("id", captureId);
    }

    // 7. Embed + write memory_chunk (non-fatal — embedding API may not be set up yet)
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
      console.warn("[webhook] Embedding skipped:", (e as Error).message);
    }

    // 8. Audit log
    await db.from("audit_log").insert({
      user_id:       userId,
      action:        "capture_created",
      resource_type: "raw_captures",
      resource_id:   captureId,
      metadata: {
        kind:       classified.kind,
        urgency:    classified.urgency,
        llm_source: source,
        routed_to:  routed?.table ?? null,
        routed_id:  routed?.id   ?? null,
      },
    });

    // 9. Reply with confirmation + urgency override keyboard
    await tgSend(
      chatId,
      buildReply(classified, source),
      urgencyKeyboard(captureId),
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[webhook] Fatal error:", err);
    // Return 200 so Telegram does not keep retrying; notify user
    try {
      await tgSend(
        chatId,
        "⚠️ Something went wrong processing your capture. Please try again.",
      );
    } catch { /* best-effort */ }
    return NextResponse.json({ ok: true });
  }
}
