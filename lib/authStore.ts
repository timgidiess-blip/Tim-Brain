/**
 * Database access for browser auth: the PIN hash and WebAuthn credentials.
 *
 * All reads are resilient: if the 0002 migration has not been applied yet the
 * queries fail and we return null / [] so the app falls back to the default PIN
 * instead of locking the owner out.
 */
import { getDb } from "@/lib/supabase";

export interface StoredCredential {
  id:            string;        // row UUID
  credentialId:  string;        // base64url
  publicKey:     string;        // base64url
  counter:       number;
  transports:    string[] | null;
  deviceLabel:   string | null;
  createdAt:     string;
  lastUsedAt:    string | null;
}

// ── PIN ───────────────────────────────────────────────────────────────────────

export async function getPinHash(userId: string): Promise<string | null> {
  try {
    const db = getDb();
    const { data, error } = await db
      .from("auth_config")
      .select("pin_hash")
      .eq("id", 1)
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data) return null;
    return (data.pin_hash as string | null) ?? null;
  } catch {
    return null;
  }
}

/** Upserts the singleton PIN row. Throws if the table is missing. */
export async function setPinHash(userId: string, pinHash: string): Promise<void> {
  const db = getDb();
  const { error } = await db
    .from("auth_config")
    .upsert(
      { id: 1, user_id: userId, pin_hash: pinHash, updated_at: new Date().toISOString() },
      { onConflict: "id" },
    );
  if (error) throw new Error(error.message);
}

// ── WebAuthn credentials ────────────────────────────────────────────────────────

function mapCredential(r: Record<string, unknown>): StoredCredential {
  return {
    id:           r.id as string,
    credentialId: r.credential_id as string,
    publicKey:    r.public_key as string,
    counter:      Number(r.counter ?? 0),
    transports:   (r.transports as string[] | null) ?? null,
    deviceLabel:  (r.device_label as string | null) ?? null,
    createdAt:    r.created_at as string,
    lastUsedAt:   (r.last_used_at as string | null) ?? null,
  };
}

export async function listCredentials(userId: string): Promise<StoredCredential[]> {
  try {
    const db = getDb();
    const { data, error } = await db
      .from("webauthn_credentials")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    if (error || !data) return [];
    return (data as Record<string, unknown>[]).map(mapCredential);
  } catch {
    return [];
  }
}

export async function getCredentialByCredentialId(
  userId: string,
  credentialId: string,
): Promise<StoredCredential | null> {
  try {
    const db = getDb();
    const { data, error } = await db
      .from("webauthn_credentials")
      .select("*")
      .eq("user_id", userId)
      .eq("credential_id", credentialId)
      .maybeSingle();
    if (error || !data) return null;
    return mapCredential(data as Record<string, unknown>);
  } catch {
    return null;
  }
}

export async function addCredential(input: {
  userId:       string;
  credentialId: string;
  publicKey:    string;
  counter:      number;
  transports:   string[] | null;
  deviceLabel:  string | null;
}): Promise<void> {
  const db = getDb();
  const { error } = await db.from("webauthn_credentials").insert({
    user_id:       input.userId,
    credential_id: input.credentialId,
    public_key:    input.publicKey,
    counter:       input.counter,
    transports:    input.transports,
    device_label:  input.deviceLabel,
  });
  if (error) throw new Error(error.message);
}

export async function updateCredentialUsage(
  credentialId: string,
  counter: number,
): Promise<void> {
  try {
    const db = getDb();
    await db
      .from("webauthn_credentials")
      .update({ counter, last_used_at: new Date().toISOString() })
      .eq("credential_id", credentialId);
  } catch {
    /* non-fatal */
  }
}

export async function deleteCredential(userId: string, rowId: string): Promise<void> {
  const db = getDb();
  const { error } = await db
    .from("webauthn_credentials")
    .delete()
    .eq("user_id", userId)
    .eq("id", rowId);
  if (error) throw new Error(error.message);
}
