"use client";

import { useEffect, useRef, useState } from "react";
import { browserSupportsWebAuthn, startAuthentication } from "@simplewebauthn/browser";

// Validates that the redirect target is a same-origin relative path.
function safeFrom(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
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

export default function LoginPage() {
  const pinRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [webauthnSupported, setWebauthnSupported] = useState(false);
  const [passkeyPending, setPasskeyPending] = useState(false);
  const [passkeyNote, setPasskeyNote] = useState<string | null>(null);

  // browserSupportsWebAuthn is client-only — check after mount.
  useEffect(() => {
    setWebauthnSupported(browserSupportsWebAuthn());
  }, []);

  function redirect() {
    // Hard navigation so the browser re-runs middleware with the new cookie.
    const from = safeFrom(new URLSearchParams(window.location.search).get("from"));
    window.location.href = from;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPasskeyNote(null);
    setPending(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinRef.current?.value ?? "" }),
      });

      if (res.ok) {
        redirect();
        return;
      }

      const data: unknown = await res.json();
      setError(errorFrom(data, "Login failed"));
      pinRef.current?.select();
    } catch {
      setError("Network error — please try again");
    } finally {
      setPending(false);
    }
  }

  async function handlePasskey() {
    setError(null);
    setPasskeyNote(null);
    setPasskeyPending(true);

    try {
      const optsRes = await fetch("/api/auth/webauthn/login/options", { method: "POST" });

      if (optsRes.status === 404) {
        setPasskeyNote(
          "No passkeys enrolled yet — sign in with your PIN, then add Face ID / Touch ID in Settings.",
        );
        return;
      }
      if (!optsRes.ok) {
        const data: unknown = await optsRes.json().catch(() => null);
        setError(errorFrom(data, "Could not start passkey sign-in"));
        return;
      }

      const optionsJSON = await optsRes.json();

      let asseResp;
      try {
        asseResp = await startAuthentication({ optionsJSON });
      } catch {
        // User cancelled the biometric prompt or it was dismissed.
        setError("Passkey sign-in was cancelled.");
        return;
      }

      const verifyRes = await fetch("/api/auth/webauthn/login/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: asseResp }),
      });

      if (verifyRes.ok) {
        redirect();
        return;
      }

      const data: unknown = await verifyRes.json().catch(() => null);
      setError(errorFrom(data, "Passkey sign-in failed"));
    } catch {
      setError("Network error — please try again");
    } finally {
      setPasskeyPending(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-[360px]">

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
          {/* Heading */}
          <h1 className="text-sm font-semibold text-ink-0 mb-1">
            Sign in to your dashboard
          </h1>
          <p className="text-xs text-ink-2 mb-6">This is a private instance.</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {/* PIN field */}
            <div>
              <label htmlFor="pin" className="sr-only">PIN</label>
              <input
                ref={pinRef}
                id="pin"
                name="pin"
                type="password"
                inputMode="numeric"
                pattern="\d*"
                autoComplete="one-time-code"
                maxLength={8}
                autoFocus
                required
                placeholder="• • • •"
                aria-describedby={error ? "login-error" : undefined}
                className={[
                  "w-full rounded-lg px-3.5 py-3 text-lg text-center tracking-[0.5em]",
                  "bg-ink-4 text-ink-0 placeholder:text-ink-2 placeholder:tracking-[0.3em]",
                  "border outline-none",
                  "transition-[border-color,box-shadow] duration-150",
                  "focus:ring-2 focus:ring-offset-0",
                  error
                    ? "border-danger/60 focus:border-danger/70 focus:ring-danger/20"
                    : "border-ink-3 focus:border-accent/60 focus:ring-accent/20",
                ].join(" ")}
              />
              {error && (
                <p
                  id="login-error"
                  role="alert"
                  className="mt-2 text-xs text-danger"
                >
                  {error}
                </p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={pending || passkeyPending}
              className={[
                "w-full rounded-lg py-2.5 px-4",
                "text-sm font-semibold",
                "bg-accent transition-opacity duration-150",
                "hover:opacity-90 active:opacity-75",
                "disabled:cursor-not-allowed disabled:opacity-40",
              ].join(" ")}
              style={{ color: "var(--ink-4)" }}
            >
              {pending ? "Signing in…" : "Sign in"}
            </button>
          </form>

          {/* Passkey sign-in — client-only, only when supported */}
          {webauthnSupported && (
            <>
              {/* "or" divider */}
              <div className="flex items-center gap-3 my-5" aria-hidden>
                <div className="h-px flex-1" style={{ background: "var(--border)" }} />
                <span className="text-[11px] uppercase tracking-[0.08em] text-ink-2">or</span>
                <div className="h-px flex-1" style={{ background: "var(--border)" }} />
              </div>

              <button
                type="button"
                onClick={handlePasskey}
                disabled={pending || passkeyPending}
                aria-label="Sign in with Face ID or Touch ID"
                className={[
                  "w-full rounded-lg py-2.5 px-4 flex items-center justify-center gap-2",
                  "text-sm font-semibold",
                  "transition-opacity duration-150",
                  "hover:opacity-90 active:opacity-75",
                  "disabled:cursor-not-allowed disabled:opacity-40",
                ].join(" ")}
                style={{
                  background: "var(--surface-2)",
                  color: "var(--ink-0)",
                  border: "1px solid var(--border-strong)",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M4 8V6.5A2.5 2.5 0 0 1 6.5 4H8M16 4h1.5A2.5 2.5 0 0 1 20 6.5V8M20 16v1.5a2.5 2.5 0 0 1-2.5 2.5H16M8 20H6.5A2.5 2.5 0 0 1 4 17.5V16"
                    stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"
                  />
                  <path
                    d="M9 10v1M15 10v1M9.5 15c.7.7 1.6 1 2.5 1s1.8-.3 2.5-1"
                    stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"
                  />
                </svg>
                {passkeyPending ? "Waiting for device…" : "Sign in with Face ID / Touch ID"}
              </button>

              {passkeyNote && (
                <p role="status" className="mt-3 text-xs text-ink-2 text-center">
                  {passkeyNote}
                </p>
              )}
            </>
          )}
        </div>

      </div>
    </main>
  );
}
