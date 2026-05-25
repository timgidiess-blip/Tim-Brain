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
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
            style={{
              background:
                "linear-gradient(135deg, var(--accent), oklch(72% 0.19 195))",
            }}
          >
            <span
              className="font-bold leading-none"
              style={{ color: "var(--ink-4)" }}
            >
              ◈
            </span>
          </div>
          <span className="text-sm font-bold tracking-[0.14em] text-ink-0">
            SYNAPSE
          </span>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl border border-ink-3 p-8"
          style={{
            background: "oklch(13% 0.022 255 / 0.75)",
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
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
