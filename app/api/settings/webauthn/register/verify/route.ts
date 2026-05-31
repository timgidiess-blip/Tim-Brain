import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { ownerId } from "@/lib/auth";
import { addCredential } from "@/lib/authStore";
import {
  verifyRegistrationResponse,
  relyingParty,
  b64,
  REG_CHALLENGE_COOKIE,
} from "@/lib/webauthn";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const owner = ownerId();
  const { rpID, origin } = relyingParty(req);

  const jar = await cookies();
  const expectedChallenge = jar.get(REG_CHALLENGE_COOKIE)?.value;
  if (!expectedChallenge) {
    return NextResponse.json({ error: "Challenge expired — try again" }, { status: 400 });
  }

  let body: { response?: RegistrationResponseJSON; label?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!body.response) {
    return NextResponse.json({ error: "Missing registration response" }, { status: 400 });
  }

  try {
    const verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ error: "Could not verify passkey" }, { status: 400 });
    }

    const { credential } = verification.registrationInfo;
    await addCredential({
      userId:       owner,
      credentialId: credential.id,
      publicKey:    b64.fromBuffer(credential.publicKey),
      counter:      credential.counter,
      transports:   credential.transports ?? null,
      deviceLabel:  typeof body.label === "string" && body.label.trim()
        ? body.label.trim().slice(0, 60)
        : "Passkey",
    });

    jar.set(REG_CHALLENGE_COOKIE, "", { path: "/", maxAge: 0 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[webauthn/register/verify]", err);
    const msg = err instanceof Error ? err.message : "Verification failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
