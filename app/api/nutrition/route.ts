import { type NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/supabase";

export interface Meal {
  id:        string;
  t:         string;   // "HH:MM"
  n:         string;   // name
  kcal:      number;
  p:         number;
  c:         number;
  f:         number;
  estimated: boolean;
}

export interface NutritionDay {
  date:   string;                                // YYYY-MM-DD
  meals:  Meal[];
  totals: { kcal: number; p: number; c: number; f: number };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const userId = process.env.TELEGRAM_USER_ID;
  if (!userId) return NextResponse.json({ error: "Not configured" }, { status: 500 });

  const days = Math.min(
    90,
    Math.max(1, parseInt(req.nextUrl.searchParams.get("days") ?? "30", 10)),
  );

  // Build the date range as YYYY-MM-DD strings (server UTC is fine for
  // historical date-range queries — the client already stored with local date).
  const dates: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  const fromDate = dates[dates.length - 1];
  const toDate   = dates[0];

  try {
    const db = getDb();
    const { data, error } = await db
      .from("daily_logs")
      .select("log_date, notes")
      .eq("user_id", userId)
      .gte("log_date", fromDate)
      .lte("log_date", toDate)
      .order("log_date", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Build a lookup: date → meals[]
    const byDate = new Map<string, Meal[]>();
    for (const row of data ?? []) {
      try {
        const notes = JSON.parse((row.notes as string | null) ?? "{}") as Record<string, unknown>;
        const n     = notes["nutrition"] as { meals?: unknown[] } | undefined;
        if (Array.isArray(n?.meals) && n.meals.length > 0) {
          byDate.set(row.log_date as string, n.meals as Meal[]);
        }
      } catch { /* skip malformed row */ }
    }

    // Fill every date in the range (empty array for days with no log)
    const result: NutritionDay[] = dates.map(date => {
      const meals  = byDate.get(date) ?? [];
      const totals = meals.reduce(
        (acc, m) => ({
          kcal: acc.kcal + (Number(m.kcal) || 0),
          p:    acc.p    + (Number(m.p)    || 0),
          c:    acc.c    + (Number(m.c)    || 0),
          f:    acc.f    + (Number(m.f)    || 0),
        }),
        { kcal: 0, p: 0, c: 0, f: 0 },
      );
      return { date, meals, totals };
    });

    return NextResponse.json({ days: result });
  } catch (err) {
    console.error("[api/nutrition GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
