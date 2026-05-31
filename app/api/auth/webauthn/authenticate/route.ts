import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type VerifiedAuthenticationResponse,
} from "@simplewebauthn/server";
import type { AuthenticationResponseJSON, AuthenticatorTransportFuture } from "@simplewebauthn/server";
import { getDb } from "@/lib/supabase";
import {
  CHALLENGE_COOKIE,
  ORIGIN,
  OWNER_ID,
  RP_ID,
  type StoredCredential,
} from "@/lib/webauthn";
import { COOKIE_NAME, SESSION_COOKIE_OPTIONS, signSession } from "@/lib/auth";

const CHALLENGE_MAX_AGE = 60 * 5;

// GET — generate authentication options
export async function GET(): Promise<NextResponse> {
  const db = getDb();
  const { data } = await db
    .from("webauthn_credentials")
    .select("credential_id, transports")
    .eq("user_id", OWNER_ID);

  if (!data || data.length === 0) {
    return NextResponse.json({ error: "No passkeys registered" }, { status: 404 });
  }

  const allowCredentials = data.map(r => ({
    id        : r.credential_id as string,
    type      : "public-key" as const,
    transports: (r.transports ?? []) as AuthenticatorTransportFuture[],
  }));

  const options = await generateAuthenticationOptions({
    rpID             : RP_ID,
    userVerification : "preferred",
    allowCredentials,
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

// POST — verify assertion and issue session
export async function POST(req: NextRequest): Promise<NextResponse> {
  const jar       = await cookies();
  const challenge = jar.get(CHALLENGE_COOKIE)?.value;
  if (!challenge) {
    return NextResponse.json({ error: "Challenge expired — try again" }, { status: 400 });
  }
  jar.delete(CHALLENGE_COOKIE);

  let body: AuthenticationResponseJSON;
  try {
    body = (await req.json()) as AuthenticationResponseJSON;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const db = getDb();
  const { data: row } = await db
    .from("webauthn_credentials")
    .select("*")
    .eq("credential_id", body.id)
    .eq("user_id", OWNER_ID)
    .maybeSingle();

  if (!row) {
    return NextResponse.json({ error: "Passkey not found" }, { status: 404 });
  }

  const stored: StoredCredential = {
    credentialId : row.credential_id as string,
    publicKey    : row.public_key as string,
    counter      : row.counter as number,
    deviceType   : row.device_type as string,
    backedUp     : row.backed_up as boolean,
    transports   : (row.transports ?? []) as AuthenticatorTransportFuture[],
  };

  let verification: VerifiedAuthenticationResponse;
  try {
    verification = await verifyAuthenticationResponse({
      response         : body,
      expectedChallenge: challenge,
      expectedOrigin   : ORIGIN,
      expectedRPID     : RP_ID,
      credential       : {
        id        : stored.credentialId,
        publicKey : Buffer.from(stored.publicKey, "base64"),
        counter   : stored.counter,
        transports: stored.transports,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }

  if (!verification.verified) {
    return NextResponse.json({ error: "Verification failed" }, { status: 401 });
  }

  // Update counter
  await db
    .from("webauthn_credentials")
    .update({ counter: verification.authenticationInfo.newCounter, last_used_at: new Date().toISOString() })
    .eq("credential_id", stored.credentialId);

  // Issue session
  const authSecret = process.env.AUTH_SECRET!;
  const token = await signSession(authSecret);
  jar.set(COOKIE_NAME, token, SESSION_COOKIE_OPTIONS);

  return NextResponse.json({ ok: true });
}
