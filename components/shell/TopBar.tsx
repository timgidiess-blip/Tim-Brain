"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import ThemeToggle from "@/components/dashboard/ThemeToggle";

function BrandMark() {
  return (
    <div
      className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[8px] text-white"
      style={{
        background: "linear-gradient(135deg, var(--col-session), var(--col-operator))",
        boxShadow: "0 0 0 1px oklch(72% 0.22 290 / 0.25), 0 4px 12px -4px oklch(56% 0.22 290 / 0.5)",
      }}
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
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
  );
}

function AvatarMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full text-[12px] font-bold text-white"
        style={{
          background: "linear-gradient(135deg, oklch(62% 0.24 290), oklch(62% 0.22 340))",
          border: "2px solid oklch(72% 0.22 290 / 0.45)",
        }}
        aria-label="Account menu"
      >
        TG
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-[calc(100%+8px)] z-50 min-w-[160px] rounded-xl border py-1 shadow-lg"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          >
            <button
              onClick={signOut}
              className="w-full px-4 py-2 text-left text-sm font-medium text-ink-1 hover:text-ink-0"
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function TopBar() {
  return (
    <header
      className="sticky top-0 z-30 -mx-5 mb-3 flex h-[58px] items-center gap-3 px-5"
      style={{
        borderBottom: "1px solid var(--border)",
        background: "color-mix(in oklch, var(--ink-4) 80%, transparent)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
      }}
    >
      <Link href="/" className="flex items-center gap-[10px]">
        <BrandMark />
        <span
          className="text-[15px] font-extrabold tracking-[0.02em]"
          style={{
            background: "linear-gradient(90deg, var(--ink-0), var(--col-session))",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          Tim&rsquo;s Brain
        </span>
      </Link>

      <div className="ml-auto flex items-center gap-3">
        <ThemeToggle />
        <AvatarMenu />
      </div>
    </header>
  );
}
