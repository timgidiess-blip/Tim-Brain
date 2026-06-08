import { type NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/supabase";
import { SECTIONS, type SectionId, type SectionLayout } from "@/components/widgets/types";

function isSection(v: string | null): v is SectionId {
  return !!v && (SECTIONS as readonly string[]).includes(v);
}

// GET /api/layout?section=tasks → { layout: WidgetLayoutItem[] }
// Returns the saved overrides only; the client merges with registry defaults.
export async function GET(req: NextRequest): Promise<NextResponse> {
  const userId = process.env.TELEGRAM_USER_ID;
  if (!userId) return NextResponse.json({ error: "TELEGRAM_USER_ID not configured" }, { status: 500 });

  const section = req.nextUrl.searchParams.get("section");
  if (!isSection(section)) return NextResponse.json({ error: "invalid section" }, { status: 422 });

  try {
    const db = getDb();
    const { data, error } = await db
      .from("dashboard_layouts")
      .select("layout")
      .eq("user_id", userId)
      .eq("section", section)
      .maybeSingle();

    if (error) {
      console.error("[api/layout GET]", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ layout: (data?.layout as SectionLayout) ?? [] });
  } catch (err) {
    console.error("[api/layout GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/layout  { section, layout } → upsert the per-section override.
export async function PUT(req: NextRequest): Promise<NextResponse> {
  const userId = process.env.TELEGRAM_USER_ID;
  if (!userId) return NextResponse.json({ error: "TELEGRAM_USER_ID not configured" }, { status: 500 });

  let body: { section?: string; layout?: SectionLayout };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (!isSection(body.section ?? null)) return NextResponse.json({ error: "invalid section" }, { status: 422 });
  if (!Array.isArray(body.layout))     return NextResponse.json({ error: "layout must be an array" }, { status: 422 });

  try {
    const db = getDb();
    const { error } = await db
      .from("dashboard_layouts")
      .upsert(
        { user_id: userId, section: body.section, layout: body.layout, updated_at: new Date().toISOString() },
        { onConflict: "user_id,section" },
      );

    if (error) {
      console.error("[api/layout PUT]", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/layout PUT]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
