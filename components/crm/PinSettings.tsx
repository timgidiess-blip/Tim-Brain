"use client";

import { useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";

type Step = "idle" | "pending" | "success" | "error";

export default function PinSettings() {
  const [currentPin, setCurrentPin] = useState("");
  const [newPin,     setNewPin]     = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinStep,    setPinStep]    = useState<Step>("idle");
  const [pinMsg,     setPinMsg]     = useState("");

  const [bioStep,    setBioStep]    = useState<Step>("idle");
  const [bioMsg,     setBioMsg]     = useState("");

  async function changePin() {
    if (newPin.length < 4 || !/^\d+$/.test(newPin)) {
      setPinMsg("PIN must be 4+ digits"); setPinStep("error"); return;
    }
    if (newPin !== confirmPin) {
      setPinMsg("PINs don't match"); setPinStep("error"); return;
    }
    setPinStep("pending"); setPinMsg("");
    try {
      const res = await fetch("/api/auth/pin", {
        method  : "PUT",
        headers : { "Content-Type": "application/json" },
        body    : JSON.stringify({ currentPin, newPin }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (res.ok) {
        setPinStep("success"); setPinMsg("PIN updated!");
        setCurrentPin(""); setNewPin(""); setConfirmPin("");
        setTimeout(() => { setPinStep("idle"); setPinMsg(""); }, 3000);
      } else {
        setPinStep("error"); setPinMsg(data.error ?? "Failed");
      }
    } catch {
      setPinStep("error"); setPinMsg("Network error");
    }
  }

  async function registerBiometric() {
    setBioStep("pending"); setBioMsg("");
    try {
      const optRes = await fetch("/api/auth/webauthn/register");
      if (!optRes.ok) { setBioStep("error"); setBioMsg("Could not start registration"); return; }
      const options = await optRes.json();

      const credential = await startRegistration({ optionsJSON: options });

      const verRes = await fetch("/api/auth/webauthn/register", {
        method  : "POST",
        headers : { "Content-Type": "application/json" },
        body    : JSON.stringify(credential),
      });
      const data = await verRes.json() as { ok?: boolean; error?: string };
      if (verRes.ok) {
        setBioStep("success"); setBioMsg("Passkey registered! You can now use Touch ID / Face ID.");
        setTimeout(() => { setBioStep("idle"); setBioMsg(""); }, 4000);
      } else {
        setBioStep("error"); setBioMsg(data.error ?? "Registration failed");
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "NotAllowedError") {
        setBioStep("idle"); setBioMsg("");
      } else {
        setBioStep("error"); setBioMsg("Registration failed — try again");
      }
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-sm">
      {/* Change PIN */}
      <div>
        <h3 className="text-sm font-semibold text-ink-0 mb-3">Change PIN</h3>
        <div className="flex flex-col gap-2">
          <input
            type="password"
            inputMode="numeric"
            maxLength={8}
            placeholder="Current PIN"
            value={currentPin}
            onChange={e => setCurrentPin(e.target.value.replace(/\D/g,""))}
            className="w-full rounded-lg px-3.5 py-2.5 text-sm bg-ink-4 text-ink-0 placeholder:text-ink-2 border border-ink-3 outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
          />
          <input
            type="password"
            inputMode="numeric"
            maxLength={8}
            placeholder="New PIN (4–8 digits)"
            value={newPin}
            onChange={e => setNewPin(e.target.value.replace(/\D/g,""))}
            className="w-full rounded-lg px-3.5 py-2.5 text-sm bg-ink-4 text-ink-0 placeholder:text-ink-2 border border-ink-3 outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
          />
          <input
            type="password"
            inputMode="numeric"
            maxLength={8}
            placeholder="Confirm new PIN"
            value={confirmPin}
            onChange={e => setConfirmPin(e.target.value.replace(/\D/g,""))}
            className="w-full rounded-lg px-3.5 py-2.5 text-sm bg-ink-4 text-ink-0 placeholder:text-ink-2 border border-ink-3 outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
          />
          {pinMsg && (
            <p className={`text-xs ${pinStep === "success" ? "text-green-400" : "text-danger"}`}>
              {pinMsg}
            </p>
          )}
          <button
            onClick={changePin}
            disabled={pinStep === "pending"}
            className="rounded-lg py-2.5 text-sm font-semibold bg-accent hover:opacity-90 active:opacity-75 disabled:opacity-40 transition-opacity"
            style={{ color: "var(--ink-4)" }}
          >
            {pinStep === "pending" ? "Saving…" : "Update PIN"}
          </button>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-ink-3" />

      {/* Biometric */}
      <div>
        <h3 className="text-sm font-semibold text-ink-0 mb-1">Touch ID / Face ID</h3>
        <p className="text-xs text-ink-2 mb-3">
          Register this device for biometric login. Works on MacBook (Touch ID) and iPhone (Face ID).
        </p>
        {bioMsg && (
          <p className={`text-xs mb-2 ${bioStep === "success" ? "text-green-400" : "text-danger"}`}>
            {bioMsg}
          </p>
        )}
        <button
          onClick={registerBiometric}
          disabled={bioStep === "pending"}
          className="w-full rounded-lg py-2.5 text-sm font-semibold bg-ink-4 border border-ink-3 text-ink-0 hover:bg-ink-3 active:opacity-75 disabled:opacity-40 transition-all"
        >
          {bioStep === "pending" ? "Waiting for biometric…" : "Register this device"}
        </button>
      </div>
    </div>
  );
}
