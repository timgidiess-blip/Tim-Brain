/**
 * GET /api/finance
 * Returns the latest finance snapshot from Supabase.
 * NEVER triggers the AI pipeline — page loads call this endpoint safely.
 */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/supabase";

export interface FinanceCategory {
  name:  string;
  value: number;  // positive = asset, negative = liability
}

export interface FinanceSnapshot {
  net_worth:   number;
  currency:    string;
  as_of:       string;
  categories:  FinanceCategory[];
  snapshot_at: string;  // ISO timestamp the pipeline ran
}

export async function GET(): Promise<NextResponse> {
  const userId = process.env.TELEGRAM_USER_ID;
  if (!userId) return NextResponse.json({ error: "Not configured" }, { status: 500 });

  try {
    const db = getDb();

    // Fetch recent rows newest-first; stop as soon as we find one with finance data.
    // We look back 60 rows — if no snapshot in 60 days something is very wrong.
    const { data, error } = await db
      .from("daily_logs")
      .select("log_date, notes")
      .eq("user_id", userId)
      .order("log_date", { ascending: false })
      .limit(60);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    for (const row of data ?? []) {
      try {
        const notes = JSON.parse((row.notes as string | null) ?? "{}") as Record<string, unknown>;
        const snap  = notes["finance"] as FinanceSnapshot | undefined;
        if (snap?.net_worth != null) {
          return NextResponse.json({ snapshot: snap, date: row.log_date });
        }
      } catch { /* malformed row — skip */ }
    }

    // No snapshot found yet
    return NextResponse.json({ snapshot: null });
  } catch (err) {
    console.error("[api/finance GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
