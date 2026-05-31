"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import Clock from "./Clock";
import ThemeToggle from "./ThemeToggle";

// Only routes that actually exist as pages — avoids dead 404 tabs.
const TABS = [
  { label: "Home",   href: "/"       },
  { label: "CRM",    href: "/crm"    },
  { label: "Brain",  href: "/brain"  },
  { label: "Health", href: "/health" },
] as const;

function BrandMark() {
  return (
    <div
      className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[8px] text-[15px] text-white"
      style={{
        background: "linear-gradient(135deg, var(--col-session), var(--col-operator))",
        boxShadow: "0 0 0 1px oklch(72% 0.22 290 / 0.25), 0 4px 12px -4px oklch(56% 0.22 290 / 0.5)",
      }}
    >
      {/* Neuron / synapse mark */}
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
        onClick={() => setOpen(o => !o)}
        className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full text-[12px] font-bold text-white"
        style={{
          background: "linear-gradient(135deg, oklch(62% 0.24 290), oklch(62% 0.22 340))",
          border: "2px solid oklch(72% 0.22 290 / 0.45)",
        }}
      >
        TG
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-[calc(100%+8px)] z-50 min-w-[140px] rounded-xl border py-1 shadow-lg"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          >
            <button
              onClick={signOut}
              className="w-full px-4 py-2 text-left text-sm font-medium text-ink-1 hover:text-ink-0 hover:bg-ink-4 transition-colors"
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function TopRail() {
  const pathname = usePathname();

  return (
    <nav
      className="sticky top-0 z-30 -mx-5 mb-[18px] flex h-[62px] items-center gap-5 px-5"
      style={{
        borderBottom: "1px solid var(--border)",
        background: "color-mix(in oklch, var(--ink-4) 78%, transparent)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
      }}
    >
      {/* Brand */}
      <Link href="/" className="flex min-w-[160px] items-center gap-[10px]">
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

      {/* Tabs */}
      <div className="flex flex-1 items-center justify-center gap-0.5">
        {TABS.map(({ label, href }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className="select-none rounded-[9px] border px-[15px] py-[6px] text-[13px] font-medium tracking-[0.02em] transition-all duration-150"
              style={
                active
                  ? {
                      color: "var(--col-session)",
                      background: "color-mix(in oklch, var(--col-session) 12%, transparent)",
                      borderColor: "color-mix(in oklch, var(--col-session) 32%, transparent)",
                    }
                  : { color: "var(--ink-2)", background: "transparent", borderColor: "transparent" }
              }
            >
              {label}
            </Link>
          );
        })}
      </div>

      {/* Right: theme toggle + clock + avatar */}
      <div className="flex min-w-[200px] items-center justify-end gap-[12px]">
        <ThemeToggle />
        <Clock />
        <AvatarMenu />
      </div>
    </nav>
  );
}
