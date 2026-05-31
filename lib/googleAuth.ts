/**
 * Google service-account authentication for server-side use only.
 * Uses Node.js built-in `crypto` — no extra packages required.
 * Do NOT import this from any edge-runtime file.
 */
import { createSign } from "crypto";

// ── JWT helpers ───────────────────────────────────────────────────────────────

function b64url(data: string | Buffer): string {
  const b64 = typeof data === "string"
    ? Buffer.from(data, "utf8").toString("base64")
    : data.toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function makeServiceAccountJWT(email: string, privateKey: string, scope: string): string {
  const header  = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const now     = Math.floor(Date.now() / 1000);
  const payload = b64url(JSON.stringify({
    iss:   email,
    scope,
    aud:   "https://oauth2.googleapis.com/token",
    exp:   now + 3600,
    iat:   now,
  }));

  const signingInput = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput, "ascii");
  const sig = b64url(signer.sign(privateKey));

  return `${signingInput}.${sig}`;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/** Scope constants for convenience. */
export const SCOPE = {
  DRIVE_READONLY:  "https://www.googleapis.com/auth/drive.readonly",
  SHEETS_READONLY: "https://www.googleapis.com/auth/spreadsheets.readonly",
} as const;

interface TokenResponse {
  access_token?:    string;
  error?:           string;
  error_description?: string;
}

/**
 * Exchanges a service-account private key for a short-lived OAuth2 bearer token.
 * The private key may have literal `\n` sequences (as stored in env vars); they
 * are automatically converted to real newlines.
 */
export async function getServiceAccountToken(scope: string): Promise<string> {
  const email  = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

  if (!email || !rawKey) {
    throw new Error(
      "Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_SERVICE_ACCOUNT_KEY env vars",
    );
  }

  // env vars store newlines as literal \n — restore them
  const privateKey = rawKey.replace(/\\n/g, "\n");

  const jwt = makeServiceAccountJWT(email, privateKey, scope);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion:  jwt,
    }),
  });

  const json = await res.json() as TokenResponse;

  if (!json.access_token) {
    throw new Error(
      `Google OAuth2 token exchange failed: ${json.error ?? "unknown"} — ${json.error_description ?? ""}`.trim(),
    );
  }

  return json.access_token;
}
