"use client";

import type { Task, Entity } from "./types";
import { URGENCY_META } from "./types";

interface Props {
  task:        Task;
  entity?:     Entity;
  onClick:     () => void;
  showUrgency?: boolean;
  dimmed?:     boolean;
  dragging?:   boolean;
}

function fmtMin(min: number) {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { month: "short", day: "numeric" });
}

export default function TaskCard({ task, entity, onClick, showUrgency = false, dimmed = false, dragging = false }: Props) {
  const meta   = URGENCY_META[task.urgency] ?? URGENCY_META.someday;
  const now    = new Date();
  const overdue = task.due_date && !task.completed_at && new Date(task.due_date) < now;

  return (
    <div
      onClick={onClick}
      className="group relative rounded-[10px] p-[11px] cursor-pointer transition-all duration-100 select-none"
      style={{
        background:   dragging ? "var(--surface-2)" : "var(--surface)",
        border:       `1px solid ${dragging ? meta.border : "var(--border)"}`,
        opacity:      dimmed ? 0.35 : 1,
        boxShadow:    dragging ? "0 12px 32px oklch(0% 0 0 / 0.5)" : undefined,
        backdropFilter: "blur(8px)",
      }}
    >
      {/* Title row */}
      <div className="flex items-start gap-[6px] mb-[7px]">
        {task.key && <span className="text-[11px] shrink-0 mt-[1px]">🔑</span>}
        <span
          className="text-[13px] font-medium leading-[1.35]"
          style={{
            color:           "var(--ink-0)",
            textDecoration:  task.completed_at ? "line-through" : undefined,
            opacity:         task.completed_at ? 0.5 : 1,
          }}
        >
          {task.title}
        </span>
      </div>

      {/* Bottom metadata row */}
      <div className="flex items-center gap-[5px] flex-wrap">
        {showUrgency && (
          <span
            className="text-[10px] font-semibold px-[6px] py-[2px] rounded-[4px]"
            style={{ color: meta.color, background: meta.bg, border: `1px solid ${meta.border}` }}
          >
            {meta.label}
          </span>
        )}

        {entity && (
          <span
            className="text-[10px] px-[6px] py-[2px] rounded-[4px]"
            style={{ color: "var(--col-operator)", background: "oklch(35% 0.10 195 / 0.15)", border: "1px solid oklch(50% 0.12 195 / 0.25)" }}
          >
            {entity.name}
          </span>
        )}

        {task.tags?.map(tag => (
          <span
            key={tag}
            className="text-[10px] px-[6px] py-[2px] rounded-[4px]"
            style={{ color: "var(--ink-2)", background: "var(--surface-2)", border: "1px solid var(--border)" }}
          >
            #{tag}
          </span>
        ))}

        {task.time_estimate_min != null && (
          <span className="text-[10px] ml-auto shrink-0" style={{ color: "var(--ink-2)" }}>
            ⏱ {fmtMin(task.time_estimate_min)}
          </span>
        )}

        {task.due_date && (
          <span
            className="text-[10px] shrink-0"
            style={{ color: overdue ? "var(--danger)" : "var(--ink-2)" }}
          >
            {overdue ? "⚠ " : "📅 "}{fmtDate(task.due_date)}
          </span>
        )}
      </div>
    </div>
  );
}
