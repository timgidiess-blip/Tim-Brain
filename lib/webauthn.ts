/**
 * WebAuthn (passkey) helpers wrapping @simplewebauthn/server.
 *
 * Powers Face ID (iPhone) / Touch ID (Mac) login via platform authenticators.
 * The single-use challenge is held in a short-lived httpOnly cookie between the
 * options and verify steps, keeping the flow stateless on the server.
 */
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { isoBase64URL, isoUint8Array } from "@simplewebauthn/server/helpers";

export const RP_NAME = "Tim's Brain";

export const REG_CHALLENGE_COOKIE  = "tb_wa_reg";
export const AUTH_CHALLENGE_COOKIE  = "tb_wa_auth";
export const CHALLENGE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 300, // 5 minutes
};

/** Relying-party id + origin, derived from the request (env-overridable). */
export function relyingParty(req: Request): { rpID: string; origin: string } {
  const url = new URL(req.url);
  const rpID   = process.env.WEBAUTHN_RP_ID  ?? url.hostname;
  const origin = process.env.WEBAUTHN_ORIGIN ?? url.origin;
  return { rpID, origin };
}

// Copy into a fresh ArrayBuffer-backed Uint8Array so the type satisfies the
// library's `Uint8Array<ArrayBuffer>` parameters under strict TS.
function toArrayBufferBacked(u: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(u.length);
  out.set(u);
  return out;
}

export const b64 = {
  fromBuffer: (b: Uint8Array): string => isoBase64URL.fromBuffer(toArrayBufferBacked(b)),
  toBuffer:   (s: string): Uint8Array<ArrayBuffer> => toArrayBufferBacked(isoBase64URL.toBuffer(s)),
};

export const userIdBytes = (id: string): Uint8Array<ArrayBuffer> =>
  toArrayBufferBacked(isoUint8Array.fromUTF8String(id));

export {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
};
