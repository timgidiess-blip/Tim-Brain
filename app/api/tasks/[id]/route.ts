import { type NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/supabase";
import { writeMemory } from "@/lib/memory";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  const { id } = await ctx.params;
  const userId = process.env.TELEGRAM_USER_ID;
  if (!userId) return NextResponse.json({ error: "Not configured" }, { status: 500 });

  let body: Record<string, unknown>;
  try { body = await req.json() as Record<string, unknown>; }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  // Allowlist patchable fields
  const allowed = ["title","description","urgency","key","priority_score",
                   "time_estimate_min","tags","due_date","entity_id","owner","completed_at"];
  const patch: Record<string, unknown> = {};
  for (const k of allowed) if (k in body) patch[k] = body[k];
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "No fields to update" }, { status: 422 });

  try {
    const db = getDb();
    const { data, error } = await db
      .from("tasks")
      .update(patch)
      .eq("id", id)
      .eq("user_id", userId)
      .select("id, title, description, urgency, key, priority_score, time_estimate_min, tags, entity_id, due_date, completed_at, owner, created_at, updated_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Re-embed on every meaningful update so the memory chunk stays fresh
    if (data) {
      const t = data as Record<string, unknown>;
      const parts = [t["title"], t["description"], (t["tags"] as string[] | null)?.join(" ")];
      const completionNote = t["completed_at"] ? "Completed task." : "";
      void writeMemory({
        source_type: "task",
        source_id:   id,
        text:        [...parts, completionNote].filter(Boolean).join(". "),
        metadata:    {
          urgency:      t["urgency"],
          key:          t["key"],
          due_date:     t["due_date"],
          completed_at: t["completed_at"],
        },
      });
    }

    return NextResponse.json({ task: data });
  } catch (err) {
    console.error("[api/tasks PATCH]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  const { id } = await ctx.params;
  const userId = process.env.TELEGRAM_USER_ID;
  if (!userId) return NextResponse.json({ error: "Not configured" }, { status: 500 });

  try {
    const db = getDb();
    const { error } = await db
      .from("tasks")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/tasks DELETE]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
