import { type NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getDb } from "@/lib/supabase";

const SYSTEM = `You are a task prioritisation assistant for a personal dashboard.
Given a list of tasks and a natural-language query, return the IDs of tasks that best match.
Respond ONLY with valid JSON — no markdown, no prose.
Schema: { "ids": string[], "reasoning": string }
• ids: up to 10 task IDs ranked by relevance (most relevant first)
• reasoning: one sentence explaining the selection`;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const userId = process.env.TELEGRAM_USER_ID;
  if (!userId) return NextResponse.json({ error: "Not configured" }, { status: 500 });

  let body: { query?: string };
  try { body = await req.json() as { query?: string }; }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const query = body.query?.trim();
  if (!query) return NextResponse.json({ error: "query required" }, { status: 422 });

  try {
    // Fetch open tasks
    const db = getDb();
    const { data: tasks, error } = await db
      .from("tasks")
      .select("id, title, urgency, key, tags, due_date, description")
      .eq("user_id", userId)
      .is("completed_at", null)
      .order("priority_score", { ascending: false, nullsFirst: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!tasks?.length) return NextResponse.json({ ids: [], reasoning: "No open tasks found." });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 503 });

    const client = new Anthropic({ apiKey });
    const now = new Date().toISOString();

    const msg = await client.messages.create({
      model:      "claude-haiku-4-5",
      max_tokens: 512,
      messages: [{
        role:    "user",
        content: `Current time: ${now}\nQuery: "${query}"\n\nTasks:\n${JSON.stringify(
          tasks.map(t => ({
            id:          t.id,
            title:       t.title,
            urgency:     t.urgency,
            key:         t.key,
            tags:        t.tags,
            due_date:    t.due_date,
            description: t.description,
          })),
          null, 2,
        )}`,
      }],
      system: SYSTEM,
    });

    const block = msg.content[0];
    if (!block || block.type !== "text") throw new Error("Unexpected response");

    const raw = block.text.trim().replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    const parsed = JSON.parse(raw) as { ids?: unknown; reasoning?: unknown };

    return NextResponse.json({
      ids:       Array.isArray(parsed.ids) ? (parsed.ids as unknown[]).filter((x): x is string => typeof x === "string") : [],
      reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : "",
    });
  } catch (err) {
    console.error("[api/tasks/smart]", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
