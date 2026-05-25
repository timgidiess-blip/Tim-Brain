import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import {
  COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  signSession,
  verifyPassword,
} from "@/lib/auth";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const authSecret = process.env.AUTH_SECRET;
  const dashPassword = process.env.DASHBOARD_PASSWORD;

  if (!authSecret || !dashPassword) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  // Parse body — be defensive; don't let a malformed payload throw a 500.
  let password = "";
  try {
    const body: unknown = await req.json();
    if (
      body !== null &&
      typeof body === "object" &&
      "password" in body &&
      typeof (body as Record<string, unknown>).password === "string"
    ) {
      password = (body as { password: string }).password;
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!password) {
    return NextResponse.json({ error: "Password required" }, { status: 400 });
  }

  const valid = await verifyPassword(password, dashPassword);

  if (!valid) {
    // Small artificial delay to blunt brute-force without blocking the event loop.
    await new Promise<void>(r => setTimeout(r, 300));
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const token = await signSession(authSecret);
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, SESSION_COOKIE_OPTIONS);

  return NextResponse.json({ ok: true });
}
