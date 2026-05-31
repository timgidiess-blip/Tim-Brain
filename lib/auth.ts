/**
 * Auth primitives shared by middleware (Edge) and API routes (Node).
 * Uses only Web Crypto — no Buffer, no Node-only modules.
 */

export const COOKIE_NAME = "synapse_session";

const enc = new TextEncoder();

// ── base64url ─────────────────────────────────────────────────────────────────

function toB64url(bytes: Uint8Array): string {
  return btoa(Array.from(bytes, b => String.fromCharCode(b)).join(""))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  const padded = s + "=".repeat((4 - (s.length % 4)) % 4);
  const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  // new Uint8Array(n) is typed as Uint8Array<ArrayBuffer>, which satisfies
  // the BufferSource constraint required by crypto.subtle.verify/sign.
  const result = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) result[i] = binary.charCodeAt(i);
  return result;
}

// ── HMAC key ──────────────────────────────────────────────────────────────────

function importHmacKey(secret: string, usage: KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    usage,
  );
}

// ── Session cookie: sign & verify ─────────────────────────────────────────────

/**
 * Returns a signed token:  base64url(payload).base64url(HMAC-SHA256(payload))
 * The payload is a base64url-encoded JSON blob { iat: ms }.
 */
export async function signSession(secret: string): Promise<string> {
  const payload = toB64url(enc.encode(JSON.stringify({ iat: Date.now() })));
  const key = await importHmacKey(secret, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(payload)));
  return `${payload}.${toB64url(sig)}`;
}

/**
 * Verifies the token using crypto.subtle.verify (constant-time).
 * Returns false on any error: malformed token, wrong secret, tampered payload.
 */
export async function verifySession(token: string, secret: string): Promise<boolean> {
  try {
    const dot = token.lastIndexOf(".");
    if (dot < 1) return false;
    const payload = token.slice(0, dot);
    const sig = fromB64url(token.slice(dot + 1));
    const key = await importHmacKey(secret, ["verify"]);
    return await crypto.subtle.verify("HMAC", key, sig, enc.encode(payload));
  } catch {
    return false;
  }
}

// ── Password comparison ───────────────────────────────────────────────────────

/**
 * Constant-time comparison: hash both strings with SHA-256 (fixed 32-byte
 * output) then XOR-accumulate so the loop never short-circuits.
 */
export async function verifyPassword(
  candidate: string,
  expected: string,
): Promise<boolean> {
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(candidate)),
    crypto.subtle.digest("SHA-256", enc.encode(expected)),
  ]);
  const av = new Uint8Array(a);
  const bv = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < 32; i++) diff |= (av[i] ?? 0) ^ (bv[i] ?? 0);
  return diff === 0;
}

// ── PIN hashing (PBKDF2-SHA256, Web Crypto only) ──────────────────────────────

/** The PIN used before one has been set in the database. */
export const DEFAULT_PIN = "0000";

const PBKDF2_ITERATIONS = 100_000;

async function pbkdf2(pin: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    keyMaterial,
    256,
  );
  return new Uint8Array(bits);
}

/** Returns an encoded hash:  pbkdf2$<iterations>$<saltB64url>$<hashB64url> */
export async function hashPin(pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(pin, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toB64url(salt)}$${toB64url(hash)}`;
}

/** Constant-time verification of a PIN against an encoded hash. */
export async function verifyPin(candidate: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = parseInt(parts[1] ?? "", 10);
  if (!Number.isFinite(iterations) || iterations < 1) return false;
  const salt     = fromB64url(parts[2] ?? "");
  const expected = fromB64url(parts[3] ?? "");
  const actual   = await pbkdf2(candidate, salt, iterations);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= (actual[i] ?? 0) ^ (expected[i] ?? 0);
  return diff === 0;
}

/** Validates PIN format: 4–8 digits. */
export function isValidPinFormat(pin: string): boolean {
  return /^\d{4,8}$/.test(pin);
}

/** The single-owner id this instance authenticates as. */
export function ownerId(): string {
  return process.env.TELEGRAM_USER_ID ?? "owner";
}

// ── Cookie options ────────────────────────────────────────────────────────────

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30, // 30 days
};
