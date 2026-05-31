"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
  startRegistration,
} from "@simplewebauthn/browser";

interface Props {
  onClose: () => void;
}

interface Passkey {
  id: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
}

// Extracts an "error" string from an unknown JSON body, with a fallback.
function errorFrom(data: unknown, fallback: string): string {
  if (
    data !== null &&
    typeof data === "object" &&
    "error" in data &&
    typeof (data as Record<string, unknown>).error === "string"
  ) {
    return (data as { error: string }).error;
  }
  return fallback;
}

function formatDate(iso: string | null): string {
  if (!iso) return "never";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { month: "short", day: "numeric", year: "numeric" });
}

const PIN_RE = /^\d{4,8}$/;

export default function SecurityPanel({ onClose }: Props) {
  /* ─── PIN state ─── */
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinSet, setPinSet] = useState<boolean | null>(null);
  const [pinSaving, setPinSaving] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSuccess, setPinSuccess] = useState<string | null>(null);

  /* ─── Passkey state ─── */
  const [webauthnSupported, setWebauthnSupported] = useState(false);
  const [platformAvailable, setPlatformAvailable] = useState<boolean | null>(null);
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [passkeysLoading, setPasskeysLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [passkeyError, setPasskeyError] = useState<string | null>(null);
  const [passkeySuccess, setPasskeySuccess] = useState<string | null>(null);
  const [label, setLabel] = useState("This device");

  const firstFieldRef = useRef<HTMLInputElement>(null);

  /* ─── Close on Escape ─── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  /* ─── Auto-focus first field on open ─── */
  useEffect(() => { setTimeout(() => firstFieldRef.current?.focus(), 50); }, []);

  /* ─── Load PIN status ─── */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/settings/pin");
        if (!res.ok) return;
        const data = await res.json() as { pinSet?: boolean };
        if (!cancelled) setPinSet(Boolean(data.pinSet));
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, []);

  /* ─── WebAuthn capability checks ─── */
  useEffect(() => {
    const supported = browserSupportsWebAuthn();
    setWebauthnSupported(supported);
    if (supported) {
      void platformAuthenticatorIsAvailable()
        .then(setPlatformAvailable)
        .catch(() => setPlatformAvailable(false));
    }
  }, []);

  /* ─── Load passkeys ─── */
  const loadPasskeys = useCallback(async () => {
    setPasskeysLoading(true);
    try {
      const res = await fetch("/api/settings/webauthn");
      if (!res.ok) return;
      const data = await res.json() as { passkeys?: Passkey[] };
      setPasskeys(data.passkeys ?? []);
    } catch { /* ignore */ }
    finally { setPasskeysLoading(false); }
  }, []);

  useEffect(() => {
    if (!webauthnSupported) { setPasskeysLoading(false); return; }
    void loadPasskeys();
  }, [webauthnSupported, loadPasskeys]);

  /* ─── PIN change ─── */
  async function handlePinSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPinError(null);
    setPinSuccess(null);

    if (!PIN_RE.test(newPin)) {
      setPinError("New PIN must be 4–8 digits.");
      return;
    }
    if (newPin !== confirmPin) {
      setPinError("New PIN and confirmation do not match.");
      return;
    }

    setPinSaving(true);
    try {
      const res = await fetch("/api/settings/pin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPin, newPin }),
      });

      if (res.ok) {
        setPinSuccess("PIN updated.");
        setPinSet(true);
        setCurrentPin("");
        setNewPin("");
        setConfirmPin("");
        return;
      }

      const data: unknown = await res.json().catch(() => null);
      setPinError(errorFrom(data, "Could not update PIN."));
    } catch {
      setPinError("Network error — please try again.");
    } finally {
      setPinSaving(false);
    }
  }

  /* ─── Enroll passkey ─── */
  async function handleEnroll() {
    setPasskeyError(null);
    setPasskeySuccess(null);
    setEnrolling(true);

    try {
      const optsRes = await fetch("/api/settings/webauthn/register/options", { method: "POST" });
      if (!optsRes.ok) {
        const data: unknown = await optsRes.json().catch(() => null);
        setPasskeyError(errorFrom(data, "Could not start enrollment."));
        return;
      }
      const optionsJSON = await optsRes.json();

      let attResp;
      try {
        attResp = await startRegistration({ optionsJSON });
      } catch {
        setPasskeyError("Enrollment was cancelled.");
        return;
      }

      const verifyRes = await fetch("/api/settings/webauthn/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: attResp, label: label.trim() || "This device" }),
      });

      if (verifyRes.ok) {
        setPasskeySuccess("Passkey added.");
        await loadPasskeys();
        return;
      }

      const data: unknown = await verifyRes.json().catch(() => null);
      setPasskeyError(errorFrom(data, "Could not add passkey."));
    } catch {
      setPasskeyError("Network error — please try again.");
    } finally {
      setEnrolling(false);
    }
  }

  /* ─── Remove passkey ─── */
  async function handleRemove(id: string) {
    setPasskeyError(null);
    setPasskeySuccess(null);
    setRemovingId(id);
    try {
      const res = await fetch(`/api/settings/webauthn?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await loadPasskeys();
        return;
      }
      const data: unknown = await res.json().catch(() => null);
      setPasskeyError(errorFrom(data, "Could not remove passkey."));
    } catch {
      setPasskeyError("Network error — please try again.");
    } finally {
      setRemovingId(null);
    }
  }

  const inputStyle = {
    background: "var(--surface-2)",
    border: "1px solid var(--border)",
    color: "var(--ink-0)",
  } as const;

  const labelCls = "block text-[11px] font-semibold mb-1 tracking-[0.06em]";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: "oklch(0% 0 0 / 0.45)", backdropFilter: "blur(2px)" }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed right-0 top-0 h-full z-50 flex flex-col"
        style={{
          width: "min(480px, 95vw)",
          background: "var(--surface)",
          borderLeft: "1px solid var(--border)",
          backdropFilter: "blur(24px)",
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Security settings"
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <span className="text-[13px] font-semibold tracking-[0.04em]" style={{ color: "var(--ink-1)" }}>
            Security
          </span>
          <button
            onClick={onClose}
            aria-label="Close security settings"
            className="w-[28px] h-[28px] rounded-[6px] flex items-center justify-center text-[16px] transition-colors"
            style={{ color: "var(--ink-2)" }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-7">

          {/* ─── PIN section ─── */}
          <section>
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-[12px] font-bold tracking-[0.06em]" style={{ color: "var(--ink-0)" }}>
                PIN
              </h2>
              {pinSet !== null && (
                <span className="text-[11px]" style={{ color: "var(--ink-2)" }}>
                  {pinSet ? "Custom PIN set" : "Using default PIN (0000)"}
                </span>
              )}
            </div>

            <form onSubmit={handlePinSubmit} className="flex flex-col gap-3">
              <div>
                <label htmlFor="current-pin" className={labelCls} style={{ color: "var(--ink-2)" }}>
                  CURRENT PIN
                </label>
                <input
                  ref={firstFieldRef}
                  id="current-pin"
                  type="password"
                  inputMode="numeric"
                  pattern="\d*"
                  autoComplete="off"
                  maxLength={8}
                  value={currentPin}
                  onChange={e => setCurrentPin(e.target.value.replace(/\D/g, ""))}
                  className="w-full rounded-[8px] px-3 py-2 text-[14px] outline-none tracking-[0.3em]"
                  style={inputStyle}
                  placeholder="••••"
                />
              </div>

              <div>
                <label htmlFor="new-pin" className={labelCls} style={{ color: "var(--ink-2)" }}>
                  NEW PIN <span className="font-normal opacity-60">(4–8 digits)</span>
                </label>
                <input
                  id="new-pin"
                  type="password"
                  inputMode="numeric"
                  pattern="\d*"
                  autoComplete="off"
                  maxLength={8}
                  value={newPin}
                  onChange={e => setNewPin(e.target.value.replace(/\D/g, ""))}
                  className="w-full rounded-[8px] px-3 py-2 text-[14px] outline-none tracking-[0.3em]"
                  style={inputStyle}
                  placeholder="••••"
                />
              </div>

              <div>
                <label htmlFor="confirm-pin" className={labelCls} style={{ color: "var(--ink-2)" }}>
                  CONFIRM NEW PIN
                </label>
                <input
                  id="confirm-pin"
                  type="password"
                  inputMode="numeric"
                  pattern="\d*"
                  autoComplete="off"
                  maxLength={8}
                  value={confirmPin}
                  onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                  className="w-full rounded-[8px] px-3 py-2 text-[14px] outline-none tracking-[0.3em]"
                  style={inputStyle}
                  placeholder="••••"
                />
              </div>

              {pinError && (
                <p role="alert" className="text-[12px]" style={{ color: "var(--danger)" }}>
                  {pinError}
                </p>
              )}
              {pinSuccess && (
                <p role="status" className="text-[12px]" style={{ color: "var(--ok)" }}>
                  {pinSuccess}
                </p>
              )}

              <button
                type="submit"
                disabled={pinSaving}
                className="self-start px-4 py-[7px] rounded-[8px] text-[12px] font-semibold transition-all"
                style={{
                  background: "var(--accent)",
                  color: "var(--ink-4)",
                  opacity: pinSaving ? 0.45 : 1,
                }}
              >
                {pinSaving ? "Updating…" : "Update PIN"}
              </button>
            </form>
          </section>

          <div className="h-px" style={{ background: "var(--border)" }} />

          {/* ─── Passkeys section ─── */}
          <section>
            <h2 className="text-[12px] font-bold tracking-[0.06em] mb-1" style={{ color: "var(--ink-0)" }}>
              Passkeys (Face ID / Touch ID)
            </h2>
            <p className="text-[11px] mb-3" style={{ color: "var(--ink-2)" }}>
              Sign in with your device biometrics instead of a PIN.
            </p>

            {!webauthnSupported ? (
              <p className="text-[12px]" style={{ color: "var(--ink-2)" }}>
                This browser does not support passkeys.
              </p>
            ) : (
              <>
                {platformAvailable === false && (
                  <p
                    className="text-[12px] px-3 py-2 rounded-[8px] mb-3"
                    style={{
                      background: "oklch(62% 0.16 70 / 0.12)",
                      border: "1px solid oklch(62% 0.16 70 / 0.30)",
                      color: "var(--warn)",
                    }}
                  >
                    This device has no built-in biometric authenticator (Face ID / Touch ID).
                  </p>
                )}

                {/* Passkey list */}
                {passkeysLoading ? (
                  <p className="text-[12px]" style={{ color: "var(--ink-2)" }}>Loading…</p>
                ) : passkeys.length === 0 ? (
                  <p className="text-[12px] mb-3" style={{ color: "var(--ink-2)" }}>
                    No passkeys enrolled yet.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2 mb-3">
                    {passkeys.map(pk => (
                      <li
                        key={pk.id}
                        className="flex items-center justify-between gap-3 px-3 py-2 rounded-[8px]"
                        style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
                      >
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium truncate" style={{ color: "var(--ink-0)" }}>
                            {pk.label}
                          </div>
                          <div className="text-[11px]" style={{ color: "var(--ink-2)" }}>
                            Added {formatDate(pk.createdAt)} · Last used {formatDate(pk.lastUsedAt)}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemove(pk.id)}
                          disabled={removingId === pk.id}
                          aria-label={`Remove passkey ${pk.label}`}
                          className="shrink-0 px-2.5 py-[5px] rounded-[7px] text-[11px] font-medium transition-all"
                          style={{
                            background: "transparent",
                            border: "1px solid var(--border-strong)",
                            color: "var(--danger)",
                            opacity: removingId === pk.id ? 0.5 : 1,
                          }}
                        >
                          {removingId === pk.id ? "Removing…" : "Remove"}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Add device */}
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label htmlFor="passkey-label" className={labelCls} style={{ color: "var(--ink-2)" }}>
                      DEVICE NAME
                    </label>
                    <input
                      id="passkey-label"
                      type="text"
                      value={label}
                      onChange={e => setLabel(e.target.value)}
                      maxLength={40}
                      className="w-full rounded-[8px] px-3 py-2 text-[13px] outline-none"
                      style={inputStyle}
                      placeholder="iPhone, Mac…"
                    />
                  </div>
                  <button
                    onClick={handleEnroll}
                    disabled={enrolling}
                    aria-label="Add this device as a passkey"
                    className="shrink-0 px-3 py-2 rounded-[8px] text-[12px] font-semibold transition-all"
                    style={{
                      background: "var(--col-session)",
                      color: "#000",
                      opacity: enrolling ? 0.45 : 1,
                    }}
                  >
                    {enrolling ? "Waiting…" : "+ Add this device"}
                  </button>
                </div>

                {passkeyError && (
                  <p role="alert" className="mt-3 text-[12px]" style={{ color: "var(--danger)" }}>
                    {passkeyError}
                  </p>
                )}
                {passkeySuccess && (
                  <p role="status" className="mt-3 text-[12px]" style={{ color: "var(--ok)" }}>
                    {passkeySuccess}
                  </p>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
