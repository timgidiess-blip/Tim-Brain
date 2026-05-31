/**
 * Finance snapshot pipeline — Drive → exceljs → Claude → Supabase.
 *
 * Auth:
 *   GET  — Vercel cron only (Authorization: Bearer CRON_SECRET, injected automatically)
 *   POST — manual refresh from authenticated dashboard session
 *
 * NEVER called on page load. Only cron or the explicit refresh button.
 */
import { type NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getDb } from "@/lib/supabase";
import { getServiceAccountToken, SCOPE } from "@/lib/googleAuth";
import type { FinanceSnapshot } from "@/app/api/finance/route";

// Force Node.js runtime so exceljs (and crypto) are available
export const runtime = "nodejs";
export const maxDuration = 60; // Vercel Pro allows up to 300s; use 60s to be safe

// ── Claude system prompt ───────────────────────────────────────────────────────

const CLAUDE_SYSTEM = `You are a personal-finance data extractor. You receive a raw spreadsheet dump and produce a structured summary. Output ONLY valid JSON — no markdown, no code fences, no explanation.`;

const CLAUDE_USER_TEMPLATE = (dump: string) => `\
Spreadsheet dump (tab-separated, one tab per === TAB: name === header):

${dump}

Return ONLY this JSON (no other text):
{
  "net_worth": <number — total net worth>,
  "currency":  <string — 3-letter ISO currency code, e.g. "USD" or "NGN">,
  "as_of":     <string — date this data represents, YYYY-MM-DD>,
  "categories": [
    { "name": <string>, "value": <number — positive=asset, negative=liability> }
  ]
}

Rules:
• Avoid double-counting: if one tab summarises detail tabs, use only the summary.
• 5–12 meaningful categories — no sub-items, no duplicates.
• net_worth must equal the arithmetic sum of all category values.
• If no date is visible in the spreadsheet, use today's UTC date.
• Use the actual currency shown; do not convert.`;

// ── Google Drive download ─────────────────────────────────────────────────────

async function downloadAsXLSX(fileId: string, token: string): Promise<Buffer> {
  // Export Google Sheets native file as XLSX
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application%2Fvnd.openxmlformats-officedocument.spreadsheetml.sheet`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

  if (!res.ok) {
    const text = await res.text().catch(() => String(res.status));
    throw new Error(`Drive export failed (${res.status}): ${text.slice(0, 300)}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

// ── exceljs parsing ───────────────────────────────────────────────────────────

type CellVal = string | number | boolean | Date | null;

function cellToStr(v: unknown): string {
  if (v == null || v === "") return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  // exceljs formula cell: { formula, result }
  if (typeof v === "object" && v !== null) {
    const o = v as Record<string, unknown>;
    if ("result" in o) return cellToStr(o["result"]);
    if ("text"   in o) return cellToStr(o["text"]);
    if ("error"  in o) return "";
  }
  return String(v as CellVal);
}

async function parseWorkbook(buf: Buffer): Promise<Record<string, string[][]>> {
  // Dynamic import keeps this out of edge-runtime analysis
  const ExcelJS = (await import("exceljs")).default;
  const wb      = new ExcelJS.Workbook();
  // exceljs types predate the Buffer<ArrayBufferLike> generic in newer @types/node
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await wb.xlsx.load(buf as any);

  const sheets: Record<string, string[][]> = {};

  wb.eachSheet(ws => {
    const rows: string[][] = [];
    let rowIdx = 0;

    ws.eachRow({ includeEmpty: false }, row => {
      if (++rowIdx > 400) return; // hard cap per sheet
      // row.values is 1-indexed; slice off index 0
      const cells = (row.values as unknown[])
        .slice(1)
        .map(cellToStr);

      // Trim trailing empty cells
      while (cells.length && cells.at(-1) === "") cells.pop();
      if (cells.length) rows.push(cells);
    });

    if (rows.length) sheets[ws.name] = rows;
  });

  return sheets;
}

function sheetsToDump(sheets: Record<string, string[][]>): string {
  const chunks: string[] = [];
  for (const [name, rows] of Object.entries(sheets)) {
    chunks.push(`=== TAB: ${name} ===`);
    chunks.push(...rows.map(r => r.join("\t")));
    chunks.push("");
  }
  const dump = chunks.join("\n");
  // Safety cap: ~150 KB of text → well within Claude's 200 K-token window
  return dump.length > 150_000 ? dump.slice(0, 150_000) + "\n[TRUNCATED]" : dump;
}

// ── Claude extraction ─────────────────────────────────────────────────────────

async function extractWithClaude(dump: string): Promise<FinanceSnapshot> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const client = new Anthropic({ apiKey });

  const msg = await client.messages.create({
    model:      "claude-sonnet-4-5",
    max_tokens: 1024,
    system:     CLAUDE_SYSTEM,
    messages:   [{ role: "user", content: CLAUDE_USER_TEMPLATE(dump) }],
  });

  const block = msg.content[0];
  if (!block || block.type !== "text") throw new Error("Unexpected Claude response shape");

  const raw    = block.text.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  const parsed = JSON.parse(raw) as Partial<FinanceSnapshot>;

  // Validate minimally
  if (typeof parsed.net_worth !== "number") throw new Error("Claude returned non-numeric net_worth");
  if (!Array.isArray(parsed.categories))    throw new Error("Claude returned non-array categories");

  return {
    net_worth:   parsed.net_worth,
    currency:    typeof parsed.currency === "string" ? parsed.currency.toUpperCase() : "USD",
    as_of:       typeof parsed.as_of    === "string" ? parsed.as_of                 : new Date().toISOString().slice(0, 10),
    categories:  parsed.categories,
    snapshot_at: new Date().toISOString(),
  };
}

// ── Supabase persistence ──────────────────────────────────────────────────────

async function persistSnapshot(snapshot: FinanceSnapshot): Promise<void> {
  const userId = process.env.TELEGRAM_USER_ID;
  if (!userId) throw new Error("TELEGRAM_USER_ID not set");

  const today = new Date().toISOString().slice(0, 10);
  const db    = getDb();

  const { data: existing } = await db
    .from("daily_logs")
    .select("id, notes")
    .eq("user_id", userId)
    .eq("log_date", today)
    .maybeSingle();

  let notes: Record<string, unknown> = {};
  if (existing?.notes) {
    try { notes = JSON.parse(existing.notes as string) as Record<string, unknown>; }
    catch { /* start fresh */ }
  }
  notes["finance"] = snapshot;
  const notesStr = JSON.stringify(notes);

  if (existing) {
    const { error } = await db
      .from("daily_logs")
      .update({ notes: notesStr })
      .eq("id", existing.id as string);
    if (error) throw new Error(`Supabase update failed: ${error.message}`);
  } else {
    const { error } = await db
      .from("daily_logs")
      .insert({ user_id: userId, log_date: today, notes: notesStr });
    if (error) throw new Error(`Supabase insert failed: ${error.message}`);
  }
}

// ── Pipeline ──────────────────────────────────────────────────────────────────

async function runPipeline(): Promise<FinanceSnapshot> {
  const fileId = process.env.GOOGLE_SHEETS_FINANCE_ID;
  if (!fileId) throw new Error("GOOGLE_SHEETS_FINANCE_ID not set");

  console.log("[finance/snapshot] Acquiring Google access token…");
  const token = await getServiceAccountToken(
    `${SCOPE.DRIVE_READONLY} ${SCOPE.SHEETS_READONLY}`,
  );

  console.log("[finance/snapshot] Downloading workbook…");
  const xlsxBuf = await downloadAsXLSX(fileId, token);

  console.log("[finance/snapshot] Parsing workbook…");
  const sheets = await parseWorkbook(xlsxBuf);
  const dump   = sheetsToDump(sheets);
  console.log(`[finance/snapshot] Parsed ${Object.keys(sheets).length} tabs, dump ${dump.length} chars`);

  console.log("[finance/snapshot] Calling Claude…");
  const snapshot = await extractWithClaude(dump);
  console.log(`[finance/snapshot] Extracted net_worth=${snapshot.net_worth} ${snapshot.currency}`);

  console.log("[finance/snapshot] Persisting to Supabase…");
  await persistSnapshot(snapshot);

  return snapshot;
}

// ── Route handlers ────────────────────────────────────────────────────────────

/**
 * GET — Vercel cron (Authorization: Bearer CRON_SECRET).
 * Middleware validates the token before this handler runs.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  // Double-check cron secret in case middleware is bypassed in local dev
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const snapshot = await runPipeline();
    return NextResponse.json({ ok: true, snapshot });
  } catch (err) {
    console.error("[finance/snapshot GET]", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

/**
 * POST — manual refresh from the authenticated dashboard.
 * Session cookie auth is handled by middleware; no extra check needed here.
 */
export async function POST(): Promise<NextResponse> {
  try {
    const snapshot = await runPipeline();
    return NextResponse.json({ ok: true, snapshot });
  } catch (err) {
    console.error("[finance/snapshot POST]", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
