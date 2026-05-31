import { type NextRequest, NextResponse } from "next/server";
import OpenAI, { toFile } from "openai";
import { processCapture } from "@/lib/pipeline/processCapture";

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
  if (!message) return NextResponse.json({ ok: true }); // e.g. callback_query

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

    // 9. Reply with confirmation + urgency override keyboard
    await tgSend(
      chatId,
      buildReply(result.kind, result.urgency, result.tags, result.summary, result.llmSource),
      urgencyKeyboard(result.captureId),
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
