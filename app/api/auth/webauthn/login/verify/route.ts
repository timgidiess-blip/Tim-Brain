import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import {
  COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  signSession,
  ownerId,
} from "@/lib/auth";
import { getCredentialByCredentialId, updateCredentialUsage } from "@/lib/authStore";
import {
  verifyAuthenticationResponse,
  relyingParty,
  b64,
  AUTH_CHALLENGE_COOKIE,
} from "@/lib/webauthn";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const authSecret = process.env.AUTH_SECRET;
  if (!authSecret) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const owner = ownerId();
  const { rpID, origin } = relyingParty(req);

  const jar = await cookies();
  const expectedChallenge = jar.get(AUTH_CHALLENGE_COOKIE)?.value;
  if (!expectedChallenge) {
    return NextResponse.json({ error: "Challenge expired — try again" }, { status: 400 });
  }

  let response: AuthenticationResponseJSON;
  try {
    const body = (await req.json()) as { response?: AuthenticationResponseJSON };
    if (!body.response) throw new Error("missing");
    response = body.response;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const stored = await getCredentialByCredentialId(owner, response.id);
  if (!stored) {
    return NextResponse.json({ error: "Unknown passkey" }, { status: 401 });
  }

  try {
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id:         stored.credentialId,
        publicKey:  b64.toBuffer(stored.publicKey),
        counter:    stored.counter,
        transports: (stored.transports ?? undefined) as never,
      },
    });

    if (!verification.verified) {
      return NextResponse.json({ error: "Verification failed" }, { status: 401 });
    }

    await updateCredentialUsage(stored.credentialId, verification.authenticationInfo.newCounter);

    const token = await signSession(authSecret);
    jar.set(COOKIE_NAME, token, SESSION_COOKIE_OPTIONS);
    jar.set(AUTH_CHALLENGE_COOKIE, "", { path: "/", maxAge: 0 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[webauthn/login/verify]", err);
    return NextResponse.json({ error: "Verification failed" }, { status: 401 });
  }
}
