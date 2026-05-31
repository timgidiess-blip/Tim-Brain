import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { ownerId } from "@/lib/auth";
import { listCredentials } from "@/lib/authStore";
import {
  generateAuthenticationOptions,
  relyingParty,
  AUTH_CHALLENGE_COOKIE,
  CHALLENGE_COOKIE_OPTIONS,
} from "@/lib/webauthn";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { rpID } = relyingParty(req);
  const creds = await listCredentials(ownerId());

  if (creds.length === 0) {
    return NextResponse.json({ error: "No passkeys enrolled" }, { status: 404 });
  }

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "required",
    allowCredentials: creds.map((c) => ({
      id: c.credentialId,
      transports: (c.transports ?? undefined) as never,
    })),
  });

  const jar = await cookies();
  jar.set(AUTH_CHALLENGE_COOKIE, options.challenge, CHALLENGE_COOKIE_OPTIONS);

  return NextResponse.json(options);
}
