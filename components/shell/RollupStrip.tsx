"use client";

import { useEffect, useState } from "react";
import type { SectionId } from "@/components/widgets/types";
import { SECTION_LIST } from "@/components/widgets/types";

export interface RollupItem {
  section:  SectionId;
  headline: string;
  sub?:     string;
}

interface RollupStripProps {
  active: SectionId;
  onJump: (section: SectionId) => void;
}

export default function RollupStrip({ active, onJump }: RollupStripProps) {
  const [items, setItems] = useState<Record<string, RollupItem>>({});

  useEffect(() => {
    let live = true;
    fetch("/api/rollup")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((json: { items?: RollupItem[] }) => {
        if (!live) return;
        const map: Record<string, RollupItem> = {};
        for (const it of json.items ?? []) map[it.section] = it;
        setItems(map);
      })
      .catch(() => { /* roll-up is best-effort; chips fall back to labels */ });
    return () => { live = false; };
  }, []);

  return (
    <div className="-mx-5 mb-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex gap-2">
        {SECTION_LIST.map((meta) => {
          const it = items[meta.id];
          const isActive = meta.id === active;
          return (
            <button
              key={meta.id}
              type="button"
              onClick={() => onJump(meta.id)}
              className="flex min-w-[124px] shrink-0 flex-col items-start gap-0.5 rounded-[12px] border px-3 py-2 text-left transition-all"
              style={{
                background: isActive
                  ? `color-mix(in oklch, ${meta.accent} 14%, var(--surface))`
                  : "var(--surface)",
                borderColor: isActive
                  ? `color-mix(in oklch, ${meta.accent} 40%, transparent)`
                  : "var(--border)",
              }}
            >
              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: "var(--ink-2)" }}>
                <span>{meta.icon}</span>
                {meta.label}
              </span>
              <span className="text-[14px] font-bold leading-tight" style={{ color: "var(--ink-0)" }}>
                {it?.headline ?? "—"}
              </span>
              {it?.sub && (
                <span className="text-[11px] leading-tight" style={{ color: "var(--ink-2)" }}>
                  {it.sub}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
