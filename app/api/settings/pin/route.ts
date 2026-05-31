import { type NextRequest, NextResponse } from "next/server";
import {
  verifyPin,
  hashPin,
  isValidPinFormat,
  DEFAULT_PIN,
  ownerId,
} from "@/lib/auth";
import { getPinHash, setPinHash } from "@/lib/authStore";

/** GET → whether a custom PIN has been set (vs. still the default). */
export async function GET(): Promise<NextResponse> {
  const stored = await getPinHash(ownerId());
  return NextResponse.json({ pinSet: Boolean(stored) });
}

/** PATCH → change the PIN. Requires the current PIN. */
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  let currentPin = "";
  let newPin = "";
  try {
    const body = (await req.json()) as Record<string, unknown>;
    if (typeof body.currentPin === "string") currentPin = body.currentPin;
    if (typeof body.newPin === "string") newPin = body.newPin;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!isValidPinFormat(newPin)) {
    return NextResponse.json({ error: "PIN must be 4–8 digits" }, { status: 422 });
  }

  const owner  = ownerId();
  const stored = await getPinHash(owner);
  const valid  = stored ? await verifyPin(currentPin, stored) : currentPin === DEFAULT_PIN;
  if (!valid) {
    await new Promise<void>(r => setTimeout(r, 400));
    return NextResponse.json({ error: "Current PIN is incorrect" }, { status: 401 });
  }

  try {
    const hash = await hashPin(newPin);
    await setPinHash(owner, hash);
  } catch (err) {
    console.error("[settings/pin] setPinHash:", err);
    return NextResponse.json(
      { error: "Could not save PIN. Has the 0002 migration been applied?" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
