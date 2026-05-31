import type { AuthenticatorTransportFuture } from "@simplewebauthn/server";

export const RP_NAME         = "Synapse";
export const RP_ID           = process.env.WEBAUTHN_RP_ID    ?? "localhost";
export const ORIGIN          = process.env.WEBAUTHN_ORIGIN   ?? "http://localhost:3000";
export const OWNER_ID        = process.env.TELEGRAM_USER_ID  ?? "owner";
export const CHALLENGE_COOKIE = "synapse_wa_challenge";

export interface StoredCredential {
  credentialId : string;                         // base64url
  publicKey    : string;                         // base64url
  counter      : number;
  deviceType   : string;
  backedUp     : boolean;
  transports   : AuthenticatorTransportFuture[];
}
