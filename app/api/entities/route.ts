import { type NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/supabase";

export interface EntityRow { id: string; name: string; kind: string }

export async function GET(_req: NextRequest): Promise<NextResponse> {
  const userId = process.env.TELEGRAM_USER_ID;
  if (!userId) return NextResponse.json({ error: "Not configured" }, { status: 500 });
  try {
    const db = getDb();
    const { data, error } = await db
      .from("entities")
      .select("id, name, kind")
      .eq("user_id", userId)
      .order("name");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ entities: (data ?? []) as EntityRow[] });
  } catch (err) {
    console.error("[api/entities]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
