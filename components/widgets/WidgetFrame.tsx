"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Panel from "@/components/dashboard/Panel";
import type { SectionMeta, WidgetDef, WidgetLayoutItem } from "./types";

interface WidgetFrameProps {
  def:      WidgetDef;
  item:     WidgetLayoutItem;
  meta:     SectionMeta;
  editing:  boolean;
  onHide:   (widgetId: string) => void;
}

export default function WidgetFrame({ def, item, meta, editing, onHide }: WidgetFrameProps) {
  const accent = def.accent ?? meta.accent;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: def.id, disabled: !editing });

  const Body = def.component;

  return (
    <div
      ref={setNodeRef}
      className={item.colSpan === 2 ? "md:col-span-2" : ""}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
        zIndex:  isDragging ? 10 : undefined,
      }}
    >
      <Panel accent={accent}>
        <div className="mb-[13px] flex items-center justify-between">
          <span
            className="text-[10px] font-bold uppercase tracking-[0.12em]"
            style={{ color: "var(--ink-2)" }}
          >
            {def.title}
          </span>

          {editing ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onHide(def.id)}
                className="rounded-[6px] px-2 py-0.5 text-[10px] font-semibold transition-opacity hover:opacity-70"
                style={{ background: "var(--surface-2)", color: "var(--ink-2)", border: "1px solid var(--border)" }}
                aria-label={`Hide ${def.title}`}
              >
                Hide
              </button>
              <button
                type="button"
                {...attributes}
                {...listeners}
                className="cursor-grab rounded-[6px] px-2 py-0.5 text-[12px] leading-none transition-opacity hover:opacity-70 active:cursor-grabbing touch-none"
                style={{ background: "var(--surface-2)", color: "var(--ink-2)", border: "1px solid var(--border)" }}
                aria-label={`Drag ${def.title}`}
              >
                ⠿
              </button>
            </div>
          ) : (
            <span
              className="rounded-[20px] border px-[7px] py-[2px] font-mono text-[9px] font-bold tracking-[0.04em]"
              style={{
                background:   `color-mix(in oklch, ${accent} 12%, transparent)`,
                color:        accent,
                borderColor:  `color-mix(in oklch, ${accent} 28%, transparent)`,
              }}
            >
              {meta.icon}
            </span>
          )}
        </div>

        <Body />
      </Panel>
    </div>
  );
}
