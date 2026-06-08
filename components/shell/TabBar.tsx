"use client";

import type { SectionId } from "@/components/widgets/types";
import { SECTION_LIST } from "@/components/widgets/types";

interface TabBarProps {
  active: SectionId;
  onChange: (section: SectionId) => void;
}

// Mobile-first: a fixed bottom bar on small screens (thumb-reachable), and a
// horizontal segmented bar inline on larger screens.
export default function TabBar({ active, onChange }: TabBarProps) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-1.5 sm:static sm:mb-4 sm:rounded-[14px] sm:border sm:px-1.5 sm:py-1.5"
      style={{
        background: "color-mix(in oklch, var(--ink-4) 86%, transparent)",
        borderColor: "var(--border)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
      }}
    >
      <div className="mx-auto flex max-w-[640px] items-stretch justify-between gap-0.5 sm:justify-start sm:gap-1">
        {SECTION_LIST.map((meta) => {
          const isActive = meta.id === active;
          return (
            <button
              key={meta.id}
              type="button"
              onClick={() => onChange(meta.id)}
              aria-current={isActive ? "page" : undefined}
              className="flex flex-1 flex-col items-center gap-0.5 rounded-[10px] px-1 py-1.5 text-center transition-colors sm:flex-none sm:flex-row sm:gap-1.5 sm:px-3"
              style={
                isActive
                  ? {
                      color: meta.accent,
                      background: `color-mix(in oklch, ${meta.accent} 14%, transparent)`,
                    }
                  : { color: "var(--ink-2)", background: "transparent" }
              }
            >
              <span className="text-[16px] leading-none sm:text-[14px]">{meta.icon}</span>
              <span className="text-[10px] font-semibold tracking-[0.01em] sm:text-[13px]">
                {meta.short}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
