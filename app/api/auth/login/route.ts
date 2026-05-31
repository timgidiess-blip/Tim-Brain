import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import {
  COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  signSession,
  verifyPin,
  DEFAULT_PIN,
  ownerId,
} from "@/lib/auth";
import { getPinHash } from "@/lib/authStore";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const authSecret = process.env.AUTH_SECRET;
  if (!authSecret) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  // Parse body — accept `pin` (preferred) or legacy `password`.
  let pin = "";
  try {
    const body: unknown = await req.json();
    if (body !== null && typeof body === "object") {
      const b = body as Record<string, unknown>;
      if (typeof b.pin === "string") pin = b.pin;
      else if (typeof b.password === "string") pin = b.password;
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!pin) {
    return NextResponse.json({ error: "PIN required" }, { status: 400 });
  }

  // Prefer the stored PIN hash; before the 0002 migration / first set, fall
  // back to the default PIN so the owner is never locked out.
  const stored = await getPinHash(ownerId());
  const valid = stored ? await verifyPin(pin, stored) : pin === DEFAULT_PIN;

  if (!valid) {
    // Small artificial delay to blunt brute-force without blocking the event loop.
    await new Promise<void>(r => setTimeout(r, 400));
    return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
  }

  const token = await signSession(authSecret);
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, SESSION_COOKIE_OPTIONS);

  return NextResponse.json({ ok: true, usingDefaultPin: !stored });
}
