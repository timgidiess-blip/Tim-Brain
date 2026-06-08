import type { ComponentType } from "react";

// Phase 0 stand-in. Each section ships real widgets in its own phase; until then
// the grid is populated with these so layout, drag-reorder and show/hide can be
// exercised end-to-end. `makePlaceholder` binds a one-line description.
export function makePlaceholder(blurb: string): ComponentType {
  function Placeholder() {
    return (
      <div
        className="flex min-h-[88px] flex-col items-start justify-center gap-1"
        style={{ color: "var(--ink-2)" }}
      >
        <span className="text-[13px] leading-snug">{blurb}</span>
        <span className="text-[11px] opacity-70">Coming soon</span>
      </div>
    );
  }
  return Placeholder;
}
