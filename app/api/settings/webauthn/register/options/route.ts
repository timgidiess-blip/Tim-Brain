import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { ownerId } from "@/lib/auth";
import { listCredentials } from "@/lib/authStore";
import {
  generateRegistrationOptions,
  relyingParty,
  userIdBytes,
  RP_NAME,
  REG_CHALLENGE_COOKIE,
  CHALLENGE_COOKIE_OPTIONS,
} from "@/lib/webauthn";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const owner = ownerId();
  const { rpID } = relyingParty(req);
  const existing = await listCredentials(owner);

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userID: userIdBytes(owner),
    userName: "Tim's Brain",
    userDisplayName: "Tim's Brain",
    attestationType: "none",
    excludeCredentials: existing.map((c) => ({
      id: c.credentialId,
      transports: (c.transports ?? undefined) as never,
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "required",
      // Face ID / Touch ID are platform authenticators.
      authenticatorAttachment: "platform",
    },
  });

  const jar = await cookies();
  jar.set(REG_CHALLENGE_COOKIE, options.challenge, CHALLENGE_COOKIE_OPTIONS);

  return NextResponse.json(options);
}
