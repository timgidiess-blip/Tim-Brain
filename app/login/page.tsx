"use client";

import { useEffect, useState } from "react";
import {
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";

function safeFrom(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

const DIGITS = ["1","2","3","4","5","6","7","8","9","","0","⌫"];

export default function LoginPage() {
  const [pin,        setPin]        = useState("");
  const [error,      setError]      = useState<string | null>(null);
  const [pending,    setPending]    = useState(false);
  const [hasPasskey, setHasPasskey] = useState(false);

  useEffect(() => {
    fetch("/api/auth/webauthn/authenticate")
      .then(r => { if (r.ok) setHasPasskey(true); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (pin.length === 4) void submitPin(pin);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (pending) return;
      if (e.key >= "0" && e.key <= "9") press(e.key);
      else if (e.key === "Backspace") press("⌫");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, pin]);

  async function submitPin(value: string) {
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/auth/login", {
        method  : "POST",
        headers : { "Content-Type": "application/json" },
        body    : JSON.stringify({ pin: value }),
      });
      if (res.ok) {
        const from = safeFrom(new URLSearchParams(window.location.search).get("from"));
        window.location.href = from;
        return;
      }
      const data = await res.json() as { error?: string };
      setError(data.error ?? "Incorrect PIN");
      setPin("");
    } catch {
      setError("Network error — please try again");
      setPin("");
    } finally {
      setPending(false);
    }
  }

  async function handleBiometric() {
    setError(null);
    setPending(true);
    try {
      const optRes = await fetch("/api/auth/webauthn/authenticate");
      if (!optRes.ok) { setError("No passkey registered"); setPending(false); return; }
      const options = await optRes.json();

      const assertion = await startAuthentication({ optionsJSON: options });

      const verRes = await fetch("/api/auth/webauthn/authenticate", {
        method  : "POST",
        headers : { "Content-Type": "application/json" },
        body    : JSON.stringify(assertion),
      });

      if (verRes.ok) {
        const from = safeFrom(new URLSearchParams(window.location.search).get("from"));
        window.location.href = from;
        return;
      }
      const data = await verRes.json() as { error?: string };
      setError(data.error ?? "Biometric verification failed");
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "NotAllowedError") {
        setError("Biometric failed — use PIN instead");
      }
    } finally {
      setPending(false);
    }
  }

  function press(d: string) {
    if (pending) return;
    if (d === "⌫") { setPin(p => p.slice(0, -1)); setError(null); return; }
    if (d === "")  return;
    if (pin.length >= 4) return;
    setPin(p => p + d);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-[320px]">

        {/* Brand */}
        <div className="flex items-center justify-center gap-2.5 mb-10">
          <div
            className="grid h-9 w-9 place-items-center rounded-[10px] text-white"
            style={{
              background: "linear-gradient(135deg, var(--col-session), var(--col-operator))",
              boxShadow: "0 4px 14px -4px oklch(56% 0.22 290 / 0.55)",
            }}
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="6" cy="7" r="2.2" fill="currentColor" />
              <circle cx="18" cy="6" r="2.2" fill="currentColor" />
              <circle cx="17" cy="17" r="2.2" fill="currentColor" />
              <circle cx="7" cy="17" r="2.2" fill="currentColor" />
              <circle cx="12" cy="12" r="2.6" fill="currentColor" />
              <path
                d="M8 7.6 10 11M16.4 7 13.4 10.6M16 15.4 13.6 13.2M9 15.6 11 13.4"
                stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"
              />
            </svg>
          </div>
          <span className="text-base font-extrabold tracking-[0.02em] text-ink-0">
            Tim&rsquo;s Brain
          </span>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl border p-8"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
            boxShadow: "0 1px 2px oklch(0% 0 0 / 0.05), 0 16px 40px -20px oklch(0% 0 0 / 0.28)",
          }}
        >
          <h1 className="text-sm font-semibold text-ink-0 mb-1 text-center">Enter your PIN</h1>
          <p className="text-xs text-ink-2 mb-6 text-center">This is a private instance.</p>

          {/* PIN dots */}
          <div className="flex justify-center gap-4 mb-6">
            {[0,1,2,3].map(i => (
              <div
                key={i}
                className="w-3 h-3 rounded-full border-2 transition-all duration-150"
                style={{
                  borderColor : "var(--accent)",
                  background  : i < pin.length ? "var(--accent)" : "transparent",
                  transform   : i < pin.length ? "scale(1.15)" : "scale(1)",
                }}
              />
            ))}
          </div>

          {/* Error */}
          {error && (
            <p role="alert" className="text-xs text-danger text-center mb-4">{error}</p>
          )}

          {/* Number pad */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {DIGITS.map((d, i) => (
              <button
                key={i}
                onClick={() => press(d)}
                disabled={pending || d === ""}
                className={[
                  "rounded-xl py-3 text-lg font-semibold transition-all duration-100",
                  d === ""
                    ? "invisible"
                    : d === "⌫"
                    ? "bg-ink-4 text-ink-1 hover:bg-ink-3 active:scale-95"
                    : "bg-ink-4 text-ink-0 hover:bg-ink-3 active:scale-95",
                  "disabled:opacity-40 disabled:cursor-not-allowed",
                ].join(" ")}
              >
                {d}
              </button>
            ))}
          </div>

          {/* Biometric button */}
          <button
            onClick={handleBiometric}
            disabled={pending}
            className="w-full rounded-xl py-2.5 text-sm font-semibold bg-accent hover:opacity-90 active:opacity-75 disabled:opacity-40 transition-opacity"
            style={{ color: "var(--ink-4)" }}
          >
            {pending ? "Verifying…" : "Face ID / Touch ID"}
          </button>
        </div>
      </div>
    </main>
  );
}
