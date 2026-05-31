import { type NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/supabase";
import { OWNER_ID } from "@/lib/webauthn";

const enc = new TextEncoder();

async function hashPin(pin: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(pin));
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

// GET — returns whether a custom PIN is set (never returns the hash)
export async function GET(): Promise<NextResponse> {
  const db = getDb();
  const { data } = await db
    .from("user_settings")
    .select("key")
    .eq("user_id", OWNER_ID)
    .eq("key", "pin_hash")
    .maybeSingle();
  return NextResponse.json({ hasPin: !!data });
}

// PUT { currentPin, newPin }
export async function PUT(req: NextRequest): Promise<NextResponse> {
  let currentPin = "", newPin = "";
  try {
    const body = await req.json() as { currentPin?: string; newPin?: string };
    currentPin = body.currentPin ?? "";
    newPin     = body.newPin      ?? "";
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!/^\d{4,8}$/.test(newPin)) {
    return NextResponse.json({ error: "PIN must be 4–8 digits" }, { status: 400 });
  }

  const db = getDb();

  // Fetch current hash (default 0000)
  const { data } = await db
    .from("user_settings")
    .select("value")
    .eq("user_id", OWNER_ID)
    .eq("key", "pin_hash")
    .maybeSingle();

  const currentHash = data?.value ?? (await hashPin("0000"));
  const candidateHash = await hashPin(currentPin);

  if (candidateHash !== currentHash) {
    await new Promise<void>(r => setTimeout(r, 300));
    return NextResponse.json({ error: "Current PIN is incorrect" }, { status: 401 });
  }

  const newHash = await hashPin(newPin);
  await db.from("user_settings").upsert(
    { user_id: OWNER_ID, key: "pin_hash", value: newHash, updated_at: new Date().toISOString() },
    { onConflict: "user_id,key" }
  );

  return NextResponse.json({ ok: true });
}
