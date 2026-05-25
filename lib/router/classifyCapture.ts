import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

// ── Types ─────────────────────────────────────────────────────────────────────

export type CaptureKind    = "task" | "note" | "decision" | "reminder" | "habit";
export type CaptureUrgency = "today" | "this_week" | "this_month" | "someday";

export interface Classification {
  kind:      CaptureKind;
  urgency:   CaptureUrgency;
  entity_id: string | null;
  tags:      string[];
  summary:   string;
}

export interface ClassificationResult extends Classification {
  source: "claude" | "openai" | "regex";
}

// ── Prompt ────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a personal capture classifier. Return JSON only — no markdown, no explanation.

Schema:
{
  "kind": "task" | "note" | "decision" | "reminder" | "habit",
  "urgency": "today" | "this_week" | "this_month" | "someday",
  "entity_id": null,
  "tags": string[],
  "summary": string
}

kind rules:
• task      – action required; something to do
• reminder  – time-sensitive task with specific time or "don't forget"
• decision  – a choice made or being weighed
• habit     – tracking a recurring behaviour
• note      – everything else: ideas, observations, reference, information

urgency rules (infer from language cues; default "someday"):
• today      – "today", "tonight", "asap", "now", "urgent"
• this_week  – "this week", "by Friday", "EOW", "before end of week"
• this_month – "this month", "by end of month", "EOM"
• someday    – vague, no deadline, or future

tags: 0-5 lowercase single words, no # prefix
summary: ≤80 chars; imperative for task/reminder, noun phrase otherwise`;

// ── Validation ────────────────────────────────────────────────────────────────

const VALID_KINDS     = new Set<string>(["task", "note", "decision", "reminder", "habit"]);
const VALID_URGENCIES = new Set<string>(["today", "this_week", "this_month", "someday"]);

function validate(raw: unknown): Classification {
  if (!raw || typeof raw !== "object") throw new Error("Not an object");
  const r = raw as Record<string, unknown>;

  const kind = r["kind"];
  if (typeof kind !== "string" || !VALID_KINDS.has(kind))
    throw new Error(`Invalid kind: ${String(kind)}`);

  const urgency = r["urgency"];
  if (typeof urgency !== "string" || !VALID_URGENCIES.has(urgency))
    throw new Error(`Invalid urgency: ${String(urgency)}`);

  const rawTags = r["tags"];
  const tags: string[] = Array.isArray(rawTags)
    ? rawTags.filter((t): t is string => typeof t === "string").slice(0, 5)
    : [];

  const summary =
    typeof r["summary"] === "string" ? r["summary"].slice(0, 80).trim() : "—";

  return {
    kind:      kind as CaptureKind,
    urgency:   urgency as CaptureUrgency,
    entity_id: null,
    tags,
    summary,
  };
}

function parseJson(text: string): unknown {
  // Strip optional markdown code fences
  const stripped = text.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  return JSON.parse(stripped);
}

// ── Claude (primary) ──────────────────────────────────────────────────────────

async function withClaude(text: string): Promise<Classification> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model:      "claude-sonnet-4-6",
    max_tokens: 256,
    messages: [{
      role:    "user",
      content: `${SYSTEM_PROMPT}\n\nText:\n${text}`,
    }],
  });

  const block = msg.content[0];
  if (!block || block.type !== "text") throw new Error("Unexpected response shape");
  return validate(parseJson(block.text));
}

// ── OpenAI (fallback) ─────────────────────────────────────────────────────────

async function withOpenAI(text: string): Promise<Classification> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  const client  = new OpenAI({ apiKey });
  const result  = await client.chat.completions.create({
    model:           "gpt-4o-mini",
    max_tokens:      256,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user",   content: text },
    ],
  });

  const content = result.choices[0]?.message?.content;
  if (!content) throw new Error("Empty OpenAI response");
  return validate(JSON.parse(content));
}

// ── Regex (last resort) ───────────────────────────────────────────────────────

const TASK_RE     = /\b(todo|task|need to|must|have to|should|finish|complete|submit|write|send|buy|fix|check|review|schedule|book|plan|build|create|update|add|remove)\b/i;
const DECISION_RE = /\b(decided|decision|chose|choosing|going with|will use|opting for|agreed|picked|selected)\b/i;
const REMINDER_RE = /\b(remind|reminder|don't forget|do not forget|remember to|don't miss)\b/i;
const HABIT_RE    = /\b(habit|streak|daily|every day|each morning|routine|tracked|logged)\b/i;
const TODAY_RE    = /\b(today|tonight|now|asap|urgent|immediately|right now|this morning|this afternoon)\b/i;
const WEEK_RE     = /\b(this week|by friday|end of week|eow|before friday)\b/i;
const MONTH_RE    = /\b(this month|by end of month|eom|before end of month)\b/i;

function withRegex(text: string): Classification {
  let kind: CaptureKind = "note";
  if      (REMINDER_RE.test(text)) kind = "reminder";
  else if (DECISION_RE.test(text)) kind = "decision";
  else if (HABIT_RE.test(text))    kind = "habit";
  else if (TASK_RE.test(text))     kind = "task";

  let urgency: CaptureUrgency = "someday";
  if      (TODAY_RE.test(text))  urgency = "today";
  else if (WEEK_RE.test(text))   urgency = "this_week";
  else if (MONTH_RE.test(text))  urgency = "this_month";

  const tags = [...text.matchAll(/#(\w+)/g)]
    .map(m => m[1] ?? "")
    .filter((t): t is string => t.length > 0)
    .slice(0, 5);

  return { kind, urgency, entity_id: null, tags, summary: text.slice(0, 80).trim() };
}

// ── Public entry point ────────────────────────────────────────────────────────

export async function classifyCapture(text: string): Promise<ClassificationResult> {
  try {
    return { ...await withClaude(text), source: "claude" };
  } catch (err) {
    console.warn("[classifier] Claude failed:", (err as Error).message);
  }

  try {
    return { ...await withOpenAI(text), source: "openai" };
  } catch (err) {
    console.warn("[classifier] OpenAI failed:", (err as Error).message);
  }

  return { ...withRegex(text), source: "regex" };
}
