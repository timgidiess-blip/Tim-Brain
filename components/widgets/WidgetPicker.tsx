"use client";

import { useState } from "react";
import type { SectionId } from "./types";
import type { UseLayout } from "./useLayout";
import { findWidget } from "./registry";

interface WidgetPickerProps {
  section: SectionId;
  layout:  UseLayout;
}

export default function WidgetPicker({ section, layout }: WidgetPickerProps) {
  const [open, setOpen] = useState(false);

  function close() {
    setOpen(false);
    layout.setEditing(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); layout.setEditing(true); }}
        className="rounded-[8px] border px-3 py-1.5 text-[12px] font-medium transition-opacity hover:opacity-80"
        style={{ background: "var(--surface-2)", color: "var(--ink-1)", borderColor: "var(--border)" }}
      >
        Customize
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" style={{ background: "oklch(0% 0 0 / 0.4)" }} onClick={close} />
          <div
            className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[70vh] w-full max-w-[480px] overflow-y-auto rounded-t-[18px] border p-4 sm:inset-x-auto sm:bottom-auto sm:right-5 sm:top-[80px] sm:rounded-[16px]"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
            }}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[13px] font-bold" style={{ color: "var(--ink-0)" }}>
                Customize widgets
              </span>
              <button
                type="button"
                onClick={close}
                className="rounded-[8px] px-3 py-1 text-[12px] font-semibold"
                style={{ background: "var(--accent)", color: "var(--ink-4)" }}
              >
                Done
              </button>
            </div>

            <p className="mb-3 text-[11px]" style={{ color: "var(--ink-2)" }}>
              Toggle widgets on or off. Drag the ⠿ handle on a card to reorder.
            </p>

            <ul className="flex flex-col gap-1">
              {layout.items.map((item) => {
                const def = findWidget(section, item.widgetId);
                if (!def) return null;
                return (
                  <li key={item.widgetId}>
                    <label
                      className="flex cursor-pointer items-center justify-between rounded-[10px] border px-3 py-2.5"
                      style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
                    >
                      <span className="text-[13px]" style={{ color: "var(--ink-0)" }}>{def.title}</span>
                      <input
                        type="checkbox"
                        checked={item.visible}
                        onChange={() => layout.toggle(item.widgetId)}
                        className="h-4 w-4 accent-[var(--accent)]"
                      />
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </>
  );
}
