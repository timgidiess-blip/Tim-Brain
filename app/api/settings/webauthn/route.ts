import { type NextRequest, NextResponse } from "next/server";
import { ownerId } from "@/lib/auth";
import { listCredentials, deleteCredential } from "@/lib/authStore";

/** GET → list enrolled passkeys (non-sensitive fields only). */
export async function GET(): Promise<NextResponse> {
  const creds = await listCredentials(ownerId());
  return NextResponse.json({
    passkeys: creds.map((c) => ({
      id:          c.id,
      label:       c.deviceLabel ?? "Passkey",
      createdAt:   c.createdAt,
      lastUsedAt:  c.lastUsedAt,
    })),
  });
}

/** DELETE ?id=<rowId> → remove a passkey. */
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  try {
    await deleteCredential(ownerId(), id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[settings/webauthn DELETE]", err);
    return NextResponse.json({ error: "Could not remove passkey" }, { status: 500 });
  }
}
