import { type NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/supabase";
import { writeMemory } from "@/lib/memory";

export interface TaskRow {
  id:                string;
  title:             string;
  description:       string | null;
  urgency:           string | null;
  key:               boolean;
  priority_score:    number | null;
  time_estimate_min: number | null;
  tags:              string[] | null;
  entity_id:         string | null;
  owner:             string | null;
  due_date:          string | null;
  completed_at:      string | null;
  created_at:        string;
  updated_at:        string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const userId = process.env.TELEGRAM_USER_ID;
  if (!userId) return NextResponse.json({ error: "TELEGRAM_USER_ID not configured" }, { status: 500 });

  let body: Partial<TaskRow>;
  try { body = await req.json() as Partial<TaskRow>; }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (!body.title?.trim()) return NextResponse.json({ error: "title required" }, { status: 422 });

  try {
    const db = getDb();
    const { data, error } = await db
      .from("tasks")
      .insert({
        user_id:           userId,
        title:             body.title.trim(),
        description:       body.description       ?? null,
        urgency:           body.urgency           ?? "someday",
        key:               body.key               ?? false,
        priority_score:    body.priority_score    ?? null,
        time_estimate_min: body.time_estimate_min ?? null,
        tags:              body.tags              ?? null,
        due_date:          body.due_date          ?? null,
        entity_id:         body.entity_id         ?? null,
        owner:             body.owner             ?? null,
      })
      .select("id, title, description, urgency, key, priority_score, time_estimate_min, tags, entity_id, due_date, completed_at, owner, created_at, updated_at")
      .single();

    if (error || !data) return NextResponse.json({ error: error?.message ?? "no data" }, { status: 500 });
    const task = data as TaskRow;

    void writeMemory({
      source_type: "task",
      source_id:   task.id,
      text:        [task.title, task.description, task.tags?.join(" ")].filter(Boolean).join(". "),
      metadata:    { urgency: task.urgency, key: task.key, due_date: task.due_date },
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (err) {
    console.error("[api/tasks POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const userId = process.env.TELEGRAM_USER_ID;
  if (!userId) {
    return NextResponse.json(
      { error: "TELEGRAM_USER_ID not configured" },
      { status: 500 },
    );
  }

  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status"); // "open" | "done" | null (all)

  try {
    const db = getDb();

    let query = db
      .from("tasks")
      .select(
        "id, title, description, urgency, key, priority_score, time_estimate_min, tags, entity_id, due_date, completed_at, created_at, updated_at",
      )
      .eq("user_id", userId)
      .order("priority_score", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (status === "open") {
      query = query.is("completed_at", null);
    } else if (status === "done") {
      query = query.not("completed_at", "is", null);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[api/tasks] Supabase error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ tasks: (data ?? []) as TaskRow[] });
  } catch (err) {
    console.error("[api/tasks] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
