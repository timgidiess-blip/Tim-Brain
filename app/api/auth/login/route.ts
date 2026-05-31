import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, SESSION_COOKIE_OPTIONS, signSession } from "@/lib/auth";
import { getDb } from "@/lib/supabase";
import { OWNER_ID } from "@/lib/webauthn";

const enc = new TextEncoder();

async function hashPin(pin: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(pin));
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const authSecret = process.env.AUTH_SECRET;
  if (!authSecret) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  let pin = "";
  try {
    const body = await req.json() as { pin?: string; password?: string };
    pin = body.pin ?? body.password ?? "";
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!pin) {
    return NextResponse.json({ error: "PIN required" }, { status: 400 });
  }

  // Fetch stored PIN hash from DB (default: hash of "0000")
  const db = getDb();
  const { data } = await db
    .from("user_settings")
    .select("value")
    .eq("user_id", OWNER_ID)
    .eq("key", "pin_hash")
    .maybeSingle();

  const storedHash = data?.value ?? (await hashPin("0000"));
  const candidateHash = await hashPin(pin);

  if (candidateHash !== storedHash) {
    await new Promise<void>(r => setTimeout(r, 300));
    return NextResponse.json({ error: "Incorrect PIN" }, { status: 401 });
  }

  const token = await signSession(authSecret);
  const jar   = await cookies();
  jar.set(COOKIE_NAME, token, SESSION_COOKIE_OPTIONS);

  return NextResponse.json({ ok: true });
}
