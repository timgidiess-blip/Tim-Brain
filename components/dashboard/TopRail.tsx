"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Clock from "./Clock";

const TABS = [
  { label: "Home",    href: "/"        },
  { label: "CRM",     href: "/crm"     },
  { label: "Brain",   href: "/brain"   },
  { label: "Finance", href: "/finance" },
  { label: "Journal", href: "/journal" },
  { label: "Health",  href: "/health"  },
] as const;

export default function TopRail() {
  const pathname = usePathname();

  return (
    <nav
      className="flex items-center h-[62px] gap-5 mb-[18px]"
      style={{ borderBottom: "1px solid oklch(28% 0.030 255 / 0.55)" }}
    >
      {/* Brand */}
      <div className="flex items-center gap-[9px] min-w-[160px]">
        <div
          className="w-[30px] h-[30px] rounded-[7px] flex items-center justify-center text-[15px] shrink-0"
          style={{ background: "linear-gradient(135deg, var(--col-session), var(--col-operator))" }}
        >
          ◈
        </div>
        <span
          className="text-[14px] font-extrabold tracking-[0.12em]"
          style={{
            background: "linear-gradient(90deg, var(--ink-0), var(--col-operator))",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          SYNAPSE
        </span>
      </div>

      {/* Tabs */}
      <div className="flex-1 flex items-center justify-center gap-0.5">
        {TABS.map(({ label, href }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className="px-[15px] py-[5px] rounded-[8px] text-[13px] font-medium tracking-[0.02em] transition-all duration-150 select-none border"
              style={
                active
                  ? { color: "var(--col-session)", background: "oklch(72% 0.22 290 / 0.08)", borderColor: "oklch(72% 0.22 290 / 0.28)" }
                  : { color: "oklch(62% 0.018 255)", background: "transparent", borderColor: "transparent" }
              }
            >
              {label}
            </Link>
          );
        })}
      </div>

      {/* Right: clock + avatar */}
      <div className="flex items-center gap-[14px] min-w-[200px] justify-end">
        <Clock />
        <div
          className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-[12px] font-bold cursor-pointer shrink-0"
          style={{
            background: "linear-gradient(135deg, oklch(62% 0.24 290), oklch(62% 0.22 340))",
            border: "2px solid oklch(72% 0.22 290 / 0.45)",
          }}
        >
          TG
        </div>
      </div>
    </nav>
  );
}
