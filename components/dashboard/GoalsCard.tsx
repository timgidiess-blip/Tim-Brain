"use client";

import { useEffect, useRef, useState } from "react";
import Panel, { CardHeader } from "./Panel";
import type { GoalItem, GoalsPayload } from "@/app/api/goals/route";

// ── Constants ──────────────────────────────────────────────────────────────────

const ACCENT   = "var(--col-session)";
const LS_KEY   = "synapse:goals";

const SECTION = {
  week: {
    label: "THIS WEEK",
    col:   "var(--col-session)",           // violet
    bg:    "oklch(72% 0.22 290 / 0.08)",
    bd:    "oklch(72% 0.22 290 / 0.25)",
    done:  "oklch(72% 0.22 290 / 0.50)",
  },
  month: {
    label: "THIS MONTH",
    col:   "var(--col-operator)",          // teal-cyan
    bg:    "oklch(72% 0.19 195 / 0.08)",
    bd:    "oklch(72% 0.19 195 / 0.25)",
    done:  "oklch(72% 0.19 195 / 0.50)",
  },
} as const;

type Scope = keyof typeof SECTION;

// ── Helpers ────────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 9); }

// ── GoalRow sub-component ──────────────────────────────────────────────────────

function GoalRow({
  item, scope, onToggle, onDelete,
}: {
  item:     GoalItem;
  scope:    Scope;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const { col, done: doneCol } = SECTION[scope];
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="flex items-start gap-[8px] group py-[5px]"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Checkbox */}
      <button
        onClick={onToggle}
        className="shrink-0 mt-[1px] w-[15px] h-[15px] rounded-[4px] flex items-center justify-center transition-all"
        style={{
          background:  item.done ? col : "var(--surface-2)",
          border:      `1.5px solid ${item.done ? col : "var(--border-strong)"}`,
          color:       "#000",
          fontSize:    "9px",
          lineHeight:  "1",
        }}
        aria-label={item.done ? "Mark incomplete" : "Mark complete"}
      >
        {item.done ? "✓" : ""}
      </button>

      {/* Text */}
      <span
        className="flex-1 text-[12px] leading-[1.4] break-words min-w-0"
        style={{
          color:          item.done ? doneCol : "var(--ink-1)",
          textDecoration: item.done ? "line-through" : "none",
          opacity:        item.done ? 0.65 : 1,
          transition:     "all 0.15s ease",
        }}
      >
        {item.text}
      </span>

      {/* Delete (visible on hover) */}
      <button
        onClick={onDelete}
        className="shrink-0 w-[16px] h-[16px] flex items-center justify-center rounded-[3px] transition-all text-[10px] leading-none"
        style={{
          opacity:    hovered ? 0.7 : 0,
          color:      "var(--ink-2)",
          background: "transparent",
          pointerEvents: hovered ? "auto" : "none",
        }}
        aria-label="Delete goal"
      >
        ×
      </button>
    </div>
  );
}

// ── Section sub-component ──────────────────────────────────────────────────────

function GoalSection({
  scope, items, onUpdate,
}: {
  scope:    Scope;
  items:    GoalItem[];
  onUpdate: (next: GoalItem[]) => void;
}) {
  const { label, col, bg, bd } = SECTION[scope];
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const done  = items.filter(i => i.done).length;
  const total = items.length;

  function addGoal() {
    const text = input.trim();
    if (!text) return;
    onUpdate([...items, { id: uid(), text, done: false }]);
    setInput("");
  }

  function toggle(id: string) {
    onUpdate(items.map(g => g.id === id ? { ...g, done: !g.done } : g));
  }

  function remove(id: string) {
    onUpdate(items.filter(g => g.id !== id));
  }

  // Split: open first, done at bottom
  const open   = items.filter(g => !g.done);
  const closed = items.filter(g =>  g.done);

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center justify-between mb-[8px]">
        <span
          className="text-[9px] font-bold tracking-[0.12em]"
          style={{ color: col }}
        >
          {label}
        </span>
        {total > 0 && (
          <span
            className="text-[9px] font-mono px-[6px] py-[1px] rounded-[20px]"
            style={{ color: col, background: bg, border: `1px solid ${bd}` }}
          >
            {done}/{total}
          </span>
        )}
      </div>

      {/* Goal list */}
      {items.length === 0 && (
        <p className="text-[11px] mb-[6px]" style={{ color: "var(--ink-2)" }}>
          No goals yet — add one below.
        </p>
      )}

      <div className="flex flex-col">
        {open.map(item => (
          <GoalRow key={item.id} item={item} scope={scope}
            onToggle={() => toggle(item.id)}
            onDelete={() => remove(item.id)}
          />
        ))}
        {closed.length > 0 && open.length > 0 && (
          <div className="my-[3px]" style={{ borderTop: "1px solid var(--border)" }} />
        )}
        {closed.map(item => (
          <GoalRow key={item.id} item={item} scope={scope}
            onToggle={() => toggle(item.id)}
            onDelete={() => remove(item.id)}
          />
        ))}
      </div>

      {/* Add input */}
      <form
        onSubmit={e => { e.preventDefault(); addGoal(); }}
        className="flex gap-[5px] mt-[8px]"
      >
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          className="flex-1 rounded-[6px] px-[8px] py-[5px] text-[11px] outline-none"
          style={{
            background: "var(--surface-2)",
            border:     `1px solid var(--border)`,
            color:      "var(--ink-0)",
          }}
          placeholder="Add a goal…"
          maxLength={120}
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="shrink-0 w-[26px] h-[26px] rounded-[6px] flex items-center justify-center text-[14px] font-bold leading-none transition-all"
          style={{
            background: !input.trim() ? "var(--surface-2)" : col,
            color:      !input.trim() ? "var(--ink-2)"      : "#000",
            border:     `1px solid ${!input.trim() ? "var(--border)" : col}`,
          }}
          aria-label="Add goal"
        >
          +
        </button>
      </form>
    </div>
  );
}

// ── Main card ──────────────────────────────────────────────────────────────────

export default function GoalsCard() {
  const [week,  setWeek]  = useState<GoalItem[]>([]);
  const [month, setMonth] = useState<GoalItem[]>([]);

  // ── Persistence ────────────────────────────────────────────────────────────

  function persist(scope: Scope, items: GoalItem[]) {
    // Update localStorage
    try {
      const cached = JSON.parse(localStorage.getItem(LS_KEY) ?? "{}") as Partial<GoalsPayload>;
      cached[scope] = items;
      localStorage.setItem(LS_KEY, JSON.stringify(cached));
    } catch { /* ignore */ }

    // Fire-and-forget server sync
    fetch("/api/goals", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ scope, items }),
    }).catch(console.error);
  }

  function updateWeek(items: GoalItem[]) {
    setWeek(items);
    persist("week", items);
  }

  function updateMonth(items: GoalItem[]) {
    setMonth(items);
    persist("month", items);
  }

  // ── Mount: localStorage then server ───────────────────────────────────────

  useEffect(() => {
    // 1. Instant load from localStorage
    try {
      const cached = JSON.parse(localStorage.getItem(LS_KEY) ?? "{}") as Partial<GoalsPayload>;
      if (cached.week)  setWeek(cached.week);
      if (cached.month) setMonth(cached.month);
    } catch { /* ignore */ }

    // 2. Server sync (server is authoritative)
    fetch("/api/goals")
      .then(r => r.json())
      .then((j: GoalsPayload) => {
        setWeek(j.week   ?? []);
        setMonth(j.month ?? []);
        try { localStorage.setItem(LS_KEY, JSON.stringify(j)); } catch { /* ignore */ }
      })
      .catch(console.error);
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Panel accent={ACCENT}>
      <CardHeader title="Goals" badge="Persistent" />

      {/* Week section */}
      <GoalSection scope="week" items={week} onUpdate={updateWeek} />

      {/* Divider */}
      <div
        className="my-[14px]"
        style={{ borderTop: "1px solid var(--border)" }}
      />

      {/* Month section */}
      <GoalSection scope="month" items={month} onUpdate={updateMonth} />
    </Panel>
  );
}
