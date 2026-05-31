import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  type VerifiedRegistrationResponse,
} from "@simplewebauthn/server";
import type { AuthenticatorTransportFuture, RegistrationResponseJSON } from "@simplewebauthn/server";
import { getDb } from "@/lib/supabase";
import { CHALLENGE_COOKIE, ORIGIN, OWNER_ID, RP_ID, RP_NAME } from "@/lib/webauthn";

const CHALLENGE_MAX_AGE = 60 * 5; // 5 minutes

// GET — generate registration options and store challenge in cookie
export async function GET(): Promise<NextResponse> {
  const db = getDb();
  const { data: existing } = await db
    .from("webauthn_credentials")
    .select("credential_id")
    .eq("user_id", OWNER_ID);

  const excludeCredentials = (existing ?? []).map(r => ({
    id: r.credential_id as string,
    type: "public-key" as const,
  }));

  const options = await generateRegistrationOptions({
    rpName            : RP_NAME,
    rpID              : RP_ID,
    userName          : "tim",
    userDisplayName   : "Tim",
    attestationType   : "none",
    excludeCredentials,
    authenticatorSelection: {
      residentKey       : "preferred",
      userVerification  : "preferred",
    },
  });

  const jar = await cookies();
  jar.set(CHALLENGE_COOKIE, options.challenge, {
    httpOnly : true,
    secure   : process.env.NODE_ENV === "production",
    sameSite : "lax",
    path     : "/",
    maxAge   : CHALLENGE_MAX_AGE,
  });

  return NextResponse.json(options);
}

// POST — verify and store the new credential
export async function POST(req: NextRequest): Promise<NextResponse> {
  const jar     = await cookies();
  const challenge = jar.get(CHALLENGE_COOKIE)?.value;
  if (!challenge) {
    return NextResponse.json({ error: "Challenge expired — try again" }, { status: 400 });
  }
  jar.delete(CHALLENGE_COOKIE);

  let body: RegistrationResponseJSON;
  try {
    body = (await req.json()) as RegistrationResponseJSON;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  let verification: VerifiedRegistrationResponse;
  try {
    verification = await verifyRegistrationResponse({
      response         : body,
      expectedChallenge: challenge,
      expectedOrigin   : ORIGIN,
      expectedRPID     : RP_ID,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: "Verification failed" }, { status: 400 });
  }

  const { credential, credentialDeviceType, credentialBackedUp } =
    verification.registrationInfo;

  const db = getDb();
  await db.from("webauthn_credentials").insert({
    user_id      : OWNER_ID,
    credential_id: credential.id,
    public_key   : Buffer.from(credential.publicKey).toString("base64"),
    counter      : credential.counter,
    device_type  : credentialDeviceType,
    backed_up    : credentialBackedUp,
    transports   : (body.response.transports ?? []) as AuthenticatorTransportFuture[],
  });

  return NextResponse.json({ ok: true });
}
