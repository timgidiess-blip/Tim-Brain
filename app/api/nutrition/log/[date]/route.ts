import { type NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/supabase";
import { writeMemory } from "@/lib/memory";

type Ctx = { params: Promise<{ date: string }> };

export async function GET(_req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  const { date } = await ctx.params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const userId = process.env.TELEGRAM_USER_ID;
  if (!userId) return NextResponse.json({ error: "Not configured" }, { status: 500 });

  try {
    const db = getDb();
    const { data } = await db
      .from("daily_logs")
      .select("notes")
      .eq("user_id", userId)
      .eq("log_date", date)
      .maybeSingle();

    let notes: Record<string, unknown> = {};
    if (data?.notes) {
      try { notes = JSON.parse(data.notes as string) as Record<string, unknown>; }
      catch { /* malformed notes */ }
    }

    const meals = (notes["nutrition"] as { meals?: unknown[] } | undefined)?.meals ?? [];
    return NextResponse.json({ meals });
  } catch (err) {
    console.error("[api/nutrition/log GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: Ctx): Promise<NextResponse> {
  const { date } = await ctx.params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const userId = process.env.TELEGRAM_USER_ID;
  if (!userId) return NextResponse.json({ error: "Not configured" }, { status: 500 });

  let body: { meals: unknown[] };
  try { body = await req.json() as { meals: unknown[] }; }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  try {
    const db = getDb();

    // Fetch existing row to merge (preserve habits, captures, etc.)
    const { data: existing } = await db
      .from("daily_logs")
      .select("id, notes")
      .eq("user_id", userId)
      .eq("log_date", date)
      .maybeSingle();

    let notes: Record<string, unknown> = {};
    if (existing?.notes) {
      try { notes = JSON.parse(existing.notes as string) as Record<string, unknown>; }
      catch { /* start fresh */ }
    }
    notes["nutrition"] = { meals: body.meals };
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
        .insert({ user_id: userId, log_date: date, notes: notesStr });
      if (error) throw error;
    }

    // One memory chunk per meal (upserted by meal id, so edits update in-place)
    interface MealLike { id?: string; n?: string; kcal?: number; p?: number; c?: number; f?: number; estimated?: boolean }
    for (const m of body.meals as MealLike[]) {
      if (!m.id || !m.n) continue;
      void writeMemory({
        source_type: "meal",
        source_id:   `${date}:${m.id}`,
        text:        `${date}: ${m.n} — ${m.kcal ?? 0} kcal, ${m.p ?? 0}g protein, ${m.c ?? 0}g carbs, ${m.f ?? 0}g fat`,
        metadata:    { date, ...m },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/nutrition/log POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
