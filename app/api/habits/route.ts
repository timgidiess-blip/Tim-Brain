import { type NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/supabase";

export interface HabitDayData {
  done:  string[];
  total: number;
}

export type HabitsPayload = Record<string, HabitDayData>;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const userId = process.env.TELEGRAM_USER_ID;
  if (!userId) {
    return NextResponse.json({ error: "TELEGRAM_USER_ID not configured" }, { status: 500 });
  }

  const days = Math.min(
    90,
    Math.max(1, parseInt(req.nextUrl.searchParams.get("days") ?? "30", 10)),
  );

  // Compute date range — server-side; fine for querying historical data.
  const from = new Date();
  from.setDate(from.getDate() - days);
  const fromStr = from.toISOString().slice(0, 10);

  try {
    const db = getDb();
    const { data, error } = await db
      .from("daily_logs")
      .select("log_date, notes")
      .eq("user_id", userId)
      .gte("log_date", fromStr)
      .order("log_date", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const habits: HabitsPayload = {};
    for (const row of data ?? []) {
      try {
        const notes = JSON.parse(
          (row.notes as string | null) ?? "{}",
        ) as Record<string, unknown>;
        const h = notes["habits"];
        if (h && typeof h === "object" && !Array.isArray(h)) {
          const hd = h as Record<string, unknown>;
          if (Array.isArray(hd["done"]) && typeof hd["total"] === "number") {
            habits[row.log_date as string] = {
              done:  (hd["done"] as unknown[]).filter((x): x is string => typeof x === "string"),
              total: hd["total"] as number,
            };
          }
        }
      } catch { /* skip malformed row */ }
    }

    return NextResponse.json({ habits });
  } catch (err) {
    console.error("[api/habits GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
