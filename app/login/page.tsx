"use client";

import { useRef, useState } from "react";

// Validates that the redirect target is a same-origin relative path.
function safeFrom(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

export default function LoginPage() {
  const passwordRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: passwordRef.current?.value ?? "" }),
      });

      if (res.ok) {
        // Hard navigation so the browser re-runs middleware with the new cookie.
        const from = safeFrom(new URLSearchParams(window.location.search).get("from"));
        window.location.href = from;
        return;
      }

      const data: unknown = await res.json();
      const msg =
        data !== null &&
        typeof data === "object" &&
        "error" in data &&
        typeof (data as Record<string, unknown>).error === "string"
          ? (data as { error: string }).error
          : "Login failed";

      setError(msg);
      passwordRef.current?.select();
    } catch {
      setError("Network error — please try again");
    } finally {
      setPending(false);
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
            {/* Password field */}
            <div>
              <input
                ref={passwordRef}
                id="password"
                name="password"
                type="password"
                autoFocus
                autoComplete="current-password"
                required
                placeholder="Password"
                aria-describedby={error ? "login-error" : undefined}
                className={[
                  "w-full rounded-lg px-3.5 py-2.5 text-sm",
                  "bg-ink-4 text-ink-0 placeholder:text-ink-2",
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
              disabled={pending}
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
        </div>

      </div>
    </main>
  );
}
