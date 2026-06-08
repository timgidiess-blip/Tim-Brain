import { NextResponse } from "next/server";
import { SECTION_LIST } from "@/components/widgets/types";

// GET /api/rollup → { items: RollupItem[] }
// One aggregated payload for the always-visible roll-up strip. Each section
// replaces its stub headline with a real selector in its own phase; until then
// the strip shows the section name so the shell is fully wired.
export async function GET(): Promise<NextResponse> {
  const userId = process.env.TELEGRAM_USER_ID;
  if (!userId) return NextResponse.json({ error: "TELEGRAM_USER_ID not configured" }, { status: 500 });

  const items = SECTION_LIST.map((meta) => ({
    section:  meta.id,
    headline: "—",
    sub:      "No data yet",
  }));

  return NextResponse.json({ items });
}
