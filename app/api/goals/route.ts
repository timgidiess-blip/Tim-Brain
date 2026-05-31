import { type NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/supabase";
import { writeMemory } from "@/lib/memory";

/** Goals are stored on this sentinel date so they never auto-clear. */
const SENTINEL = "2000-01-01";

export interface GoalItem {
  id:   string;
  text: string;
  done: boolean;
}

export interface GoalsPayload {
  week:  GoalItem[];
  month: GoalItem[];
}

// ── GET /api/goals ────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const userId = process.env.TELEGRAM_USER_ID;
  if (!userId) return NextResponse.json({ error: "Not configured" }, { status: 500 });

  try {
    const db = getDb();
    const { data } = await db
      .from("daily_logs")
      .select("notes")
      .eq("user_id", userId)
      .eq("log_date", SENTINEL)
      .maybeSingle();

    let notes: Record<string, unknown> = {};
    if (data?.notes) {
      try { notes = JSON.parse(data.notes as string) as Record<string, unknown>; }
      catch { /* malformed — start fresh */ }
    }

    const payload: GoalsPayload = {
      week:  (notes["goals_week_items"]  as GoalItem[] | undefined) ?? [],
      month: (notes["goals_month_items"] as GoalItem[] | undefined) ?? [],
    };
    return NextResponse.json(payload);
  } catch (err) {
    console.error("[api/goals GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ── POST /api/goals ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const userId = process.env.TELEGRAM_USER_ID;
  if (!userId) return NextResponse.json({ error: "Not configured" }, { status: 500 });

  let body: { scope?: string; items?: unknown };
  try { body = await req.json() as typeof body; }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (body.scope !== "week" && body.scope !== "month") {
    return NextResponse.json({ error: "scope must be 'week' or 'month'" }, { status: 422 });
  }
  if (!Array.isArray(body.items)) {
    return NextResponse.json({ error: "items must be an array" }, { status: 422 });
  }

  const scope = body.scope as "week" | "month";
  const items = body.items as GoalItem[];
  const key   = scope === "week" ? "goals_week_items" : "goals_month_items";

  try {
    const db = getDb();

    const { data: existing } = await db
      .from("daily_logs")
      .select("id, notes")
      .eq("user_id", userId)
      .eq("log_date", SENTINEL)
      .maybeSingle();

    let notes: Record<string, unknown> = {};
    if (existing?.notes) {
      try { notes = JSON.parse(existing.notes as string) as Record<string, unknown>; }
      catch { /* start fresh */ }
    }
    notes[key] = items;
    const notesStr = JSON.stringify(notes);

    if (existing) {
      const { error } = await db
        .from("daily_logs")
        .update({ notes: notesStr })
        .eq("id", existing.id as string);
      if (error) throw error;
    } else {
      const { error } = await db
        .from("daily_logs")
        .insert({ user_id: userId, log_date: SENTINEL, notes: notesStr });
      if (error) throw error;
    }

    // Upsert one memory chunk per goal item (covers add, edit, done-toggle, delete)
    for (const item of items) {
      void writeMemory({
        source_type: "goal",
        source_id:   item.id,
        text:        `${scope} goal: "${item.text}". Status: ${item.done ? "completed" : "open"}.`,
        metadata:    { scope, done: item.done },
      });
    }

    return NextResponse.json({ ok: true, scope, count: items.length });
  } catch (err) {
    console.error("[api/goals POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
