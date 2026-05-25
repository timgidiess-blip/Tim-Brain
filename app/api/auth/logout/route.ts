import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE_NAME, SESSION_COOKIE_OPTIONS } from "@/lib/auth";

export async function POST(): Promise<NextResponse> {
  const jar = await cookies();
  // maxAge: 0 expires the cookie immediately.
  jar.set(COOKIE_NAME, "", { ...SESSION_COOKIE_OPTIONS, maxAge: 0 });
  return NextResponse.json({ ok: true });
}
