import { type NextRequest, NextResponse } from "next/server";
import OpenAI, { toFile } from "openai";
import { processCapture, applyUrgencyOverride } from "@/lib/pipeline/processCapture";
import type { CaptureUrgency } from "@/lib/router/classifyCapture";

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
interface TgCallbackQuery {
  id:       string;
  from:     TgUser;
  message?: TgMessage;
  data?:    string;
}
interface TgUpdate {
  update_id:       number;
  message?:        TgMessage;
  callback_query?: TgCallbackQuery;
}
interface TgFileResult { file_path: string }
interface TgResponse<T> { ok: boolean; result?: T }

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

async function tgAnswerCallback(
  callbackId: string,
  text?: string,
): Promise<void> {
  await fetch(`https://api.telegram.org/bot${botToken()}/answerCallbackQuery`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callback_query_id: callbackId,
      ...(text ? { text } : {}),
    }),
  });
}

async function tgEditText(
  chatId: number,
  messageId: number,
  text: string,
): Promise<void> {
  await fetch(`https://api.telegram.org/bot${botToken()}/editMessageText`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id:    chatId,
      message_id: messageId,
      text,
      parse_mode: "HTML",
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

// ── OpenAI voice transcription ────────────────────────────────────────────────

async function transcribeVoice(
  buffer: Buffer,
  mimeType = "audio/ogg",
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY missing");
  const openai = new OpenAI({ apiKey });
  const ext    = mimeType.includes("ogg") ? "ogg" : mimeType.split("/")[1] ?? "mp3";
  const file   = await toFile(buffer, `voice.${ext}`, { type: mimeType });
  const result = await openai.audio.transcriptions.create({
    model: "whisper-1",
    file,
  });
  return result.text.trim();
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
  kind:      string,
  urgency:   string,
  tags:      string[],
  summary:   string,
  llmSource: string,
): string {
  const kindEmoji    = KIND_EMOJI[kind] ?? "📌";
  const urgencyLabel = URGENCY_LABEL[urgency] ?? urgency;
  const tagsLine     = tags.length > 0
    ? `\n🏷 ${esc(tags.map(t => `#${t}`).join(" "))}`
    : "";

  return (
    `✅ <b>Captured</b> · <code>${esc(llmSource)}</code>\n` +
    `${kindEmoji} <b>${esc(kind)}</b>  ·  ${urgencyLabel} (AI)` +
    tagsLine +
    `\n\n<i>${esc(summary)}</i>\n\n` +
    `Override urgency ↓`
  );
}

// ── Urgency-override callback handling ──────────────────────────────────────────

// Maps the inline-button token → the override to apply.
const URGENCY_OVERRIDE: Record<string, { urgency?: CaptureUrgency; key?: boolean; label: string }> = {
  today:   { urgency: "today",      label: "🔴 Today"     },
  week:    { urgency: "this_week",  label: "🟡 This Week" },
  month:   { urgency: "this_month", label: "🔵 This Month" },
  someday: { urgency: "someday",    label: "⚪ Someday"   },
  key:     { key: true,             label: "🔑 Key"       },
};

async function handleCallback(cb: TgCallbackQuery): Promise<void> {
  // Authorize: same single-owner check as messages.
  const allowedId = parseInt(process.env.TELEGRAM_USER_ID ?? "", 10);
  if (!allowedId || cb.from.id !== allowedId) {
    await tgAnswerCallback(cb.id, "Unauthorized");
    return;
  }

  const userId = String(cb.from.id);

  // callback_data shape: "urg:<token>:<captureId>"
  const parts = (cb.data ?? "").split(":");
  if (parts[0] !== "urg" || parts.length < 3) {
    await tgAnswerCallback(cb.id);
    return;
  }
  const token     = parts[1] ?? "";
  const captureId = parts.slice(2).join(":");
  const override  = URGENCY_OVERRIDE[token];

  if (!override || !captureId) {
    await tgAnswerCallback(cb.id, "Unknown action");
    return;
  }

  const result = await applyUrgencyOverride({
    captureId,
    userId,
    urgency: override.urgency,
    key:     override.key,
  });

  if (!result.ok) {
    const msg =
      result.reason === "not_a_task"
        ? "Urgency applies to tasks only"
        : "Couldn't update — please try again";
    await tgAnswerCallback(cb.id, msg);
    return;
  }

  // Dismiss the button spinner with a toast, and rewrite the message so the
  // chosen urgency is reflected (and the keyboard is cleared).
  await tgAnswerCallback(cb.id, `Updated → ${override.label}`);
  if (cb.message) {
    const titleLine = result.title ? `\n\n<i>${esc(result.title)}</i>` : "";
    await tgEditText(
      cb.message.chat.id,
      cb.message.message_id,
      `✅ <b>Updated</b> · urgency set to ${override.label}${titleLine}`,
    );
  }
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

  // Inline-button taps (urgency override) arrive as callback_query, not message.
  if (update.callback_query) {
    try {
      await handleCallback(update.callback_query);
    } catch (err) {
      console.error("[webhook] callback error:", err);
      try { await tgAnswerCallback(update.callback_query.id, "Something went wrong"); }
      catch { /* best-effort */ }
    }
    return NextResponse.json({ ok: true });
  }

  const message = update.message;
  if (!message) return NextResponse.json({ ok: true });

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

    // 4–8. Shared pipeline (classify → write → route → embed → audit)
    const result = await processCapture({
      rawText,
      userId,
      source: "telegram",
      audioUrl,
    });

    // 9. Reply with confirmation. Only tasks carry an urgency the user can
    //    override, so the keyboard is attached for those captures only.
    await tgSend(
      chatId,
      buildReply(result.kind, result.urgency, result.tags, result.summary, result.llmSource),
      result.routedTo === "tasks" ? urgencyKeyboard(result.captureId) : undefined,
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
