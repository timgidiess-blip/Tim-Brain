import { type NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/supabase";
import { writeMemory } from "@/lib/memory";
import type { HabitDayData } from "@/app/api/habits/route";

// ── POST /api/habits/[date] ───────────────────────────────────────────────────
// Body: { done: string[], total: number }
// The date comes from the client's local clock (localDateKey), not the server's.
// Upserts daily_logs for that date, preserving all other notes fields.

export async function POST(
  req:     NextRequest,
  context: { params: Promise<{ date: string }> },
): Promise<NextResponse> {
  const { date } = await context.params;

  // Basic date format guard
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date — expected YYYY-MM-DD" }, { status: 400 });
  }

  const userId = process.env.TELEGRAM_USER_ID;
  if (!userId) {
    return NextResponse.json({ error: "TELEGRAM_USER_ID not configured" }, { status: 500 });
  }

  let body: HabitDayData;
  try {
    body = (await req.json()) as HabitDayData;
    if (!Array.isArray(body.done) || typeof body.total !== "number") {
      throw new Error("bad shape");
    }
  } catch {
    return NextResponse.json({ error: "Body must be { done: string[], total: number }" }, { status: 422 });
  }

  try {
    const db = getDb();

    // Fetch existing log for the date (to merge notes, not clobber captures/mood)
    const { data: existing } = await db
      .from("daily_logs")
      .select("id, notes")
      .eq("user_id", userId)
      .eq("log_date", date)
      .maybeSingle();

    // Parse existing notes, merge habits key
    let notes: Record<string, unknown> = {};
    if (existing?.notes) {
      try {
        notes = JSON.parse(existing.notes as string) as Record<string, unknown>;
      } catch { /* start fresh */ }
    }
    notes["habits"] = body;

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

    // Summarise the day's habits as a searchable sentence
    if (body.done.length > 0) {
      void writeMemory({
        source_type: "habit",
        source_id:   date,
        text:        `${date}: completed habits — ${body.done.join(", ")}. ${body.done.length} of ${body.total} done.`,
        metadata:    { date, done: body.done, total: body.total },
      });
    }

    return NextResponse.json({ ok: true, date, habits: body });
  } catch (err) {
    console.error("[api/habits POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
