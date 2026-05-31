"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Panel, { CardHeader } from "./Panel";
import { HABITS } from "@/config/habits";
import type { HabitDayData, HabitsPayload } from "@/app/api/habits/route";

// ── Constants ─────────────────────────────────────────────────────────────────

const ACCENT = "var(--col-habits)";
const COL    = "oklch(70% 0.19 225)";
const LS_KEY = "synapse:habits";

// ── Date helpers ──────────────────────────────────────────────────────────────

/**
 * Uses the USER'S local clock — never toISOString() which converts to UTC.
 * Critical for users in non-UTC timezones: without this, "today" rolls over
 * at midnight UTC instead of midnight local time.
 */
function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Monday of the ISO week containing `refDate` (local time). */
function weekMonday(refDate: Date): Date {
  const d   = new Date(refDate);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay();                     // 0=Sun … 6=Sat
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  return d;
}

/** ISO week number (1-based) for a local date. */
function isoWeekNum(d: Date): number {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayN = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayN);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  return Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

// ── localStorage helpers ──────────────────────────────────────────────────────

function lsLoad(): HabitsPayload {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? "{}") as HabitsPayload;
  } catch {
    return {};
  }
}

function lsSave(store: HabitsPayload): void {
  try { localStorage.setItem(LS_KEY, JSON.stringify(store)); } catch { /* quota */ }
}

// ── Business logic ────────────────────────────────────────────────────────────

/**
 * Consecutive days (going backwards from today) where habitId appears in done[].
 * Breaks on the first day that has a store entry but does NOT contain the habit.
 * Days with no entry at all (un-logged) break the streak.
 */
function calcStreak(store: HabitsPayload, habitId: string): number {
  const todayKey = localDateKey();
  let streak = 0;
  let d      = new Date();

  for (let i = 0; i < 365; i++) {
    const key = localDateKey(d);
    if (key > todayKey) { d = addDays(d, -1); continue; }

    const day = store[key];
    if (!day || !day.done.includes(habitId)) break;
    streak++;
    d = addDays(d, -1);
  }
  return streak;
}

type CellState = "done" | "miss" | "future" | "empty";

function cellState(
  store:    HabitsPayload,
  dateKey:  string,
  todayKey: string,
  habitId:  string,
): CellState {
  if (dateKey > todayKey) return "future";
  const day = store[dateKey];
  if (!day) return "empty";              // no log for that day at all
  return day.done.includes(habitId) ? "done" : "miss";
}

// ── POST helper ───────────────────────────────────────────────────────────────

async function syncToServer(date: string, data: HabitDayData): Promise<void> {
  try {
    await fetch(`/api/habits/${date}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(data),
    });
  } catch (e) {
    console.warn("[HabitTracker] sync failed:", e);
  }
}

// ── Cell styles ───────────────────────────────────────────────────────────────

const CELL: Record<CellState, React.CSSProperties> = {
  done: {
    background: "oklch(70% 0.19 225 / 0.22)",
    border:     "1px solid oklch(70% 0.19 225 / 0.42)",
    color:      COL,
    cursor:     "pointer",
  },
  miss: {
    background: "var(--surface-2)",
    border:     "1px solid var(--border)",
    color:      "var(--ink-2)",
    cursor:     "pointer",
  },
  empty: {
    background: "var(--surface-2)",
    border:     "1px dashed var(--border)",
    color:      "transparent",
    cursor:     "pointer",
  },
  future: {
    background: "var(--surface)",
    border:     "1px dashed var(--border)",
    color:      "transparent",
    cursor:     "default",
  },
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function HabitTrackerCard() {
  const todayRef   = useRef(localDateKey());          // stable across renders
  const todayKey   = todayRef.current;

  const [store,      setStore]      = useState<HabitsPayload>({});
  const [weekOffset, setWeekOffset] = useState(0);   // 0 = current week, -1 = last week …
  const [syncing,    setSyncing]    = useState<Record<string, boolean>>({});

  // ── Mount: load localStorage immediately, then fetch server ───────────────
  useEffect(() => {
    const local = lsLoad();
    setStore(local);

    void fetch("/api/habits?days=30")
      .then(r => r.json())
      .then((json: { habits?: HabitsPayload }) => {
        if (!json.habits) return;
        // Server is authoritative; local optimistic writes win only for today
        const serverData = json.habits;
        setStore(prev => {
          const todayLocal = prev[todayKey];  // may have unsync'd clicks
          const merged: HabitsPayload = { ...prev, ...serverData };
          // Re-apply today's local data on top (keeps optimistic clicks)
          if (todayLocal) merged[todayKey] = todayLocal;
          lsSave(merged);
          return merged;
        });
      })
      .catch(e => console.warn("[HabitTracker] fetch:", e));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Toggle a habit for a given date ───────────────────────────────────────
  const toggle = useCallback((dateKey: string, habitId: string) => {
    if (dateKey > todayKey) return;          // no future toggling

    setStore(prev => {
      const current = prev[dateKey] ?? { done: [], total: HABITS.length };
      const done    = current.done.includes(habitId)
        ? current.done.filter(id => id !== habitId)
        : [...current.done, habitId];
      const next: HabitDayData = { done, total: HABITS.length };
      const updated = { ...prev, [dateKey]: next };
      lsSave(updated);

      // Fire-and-forget sync (non-blocking)
      setSyncing(s => ({ ...s, [dateKey]: true }));
      void syncToServer(dateKey, next).finally(() =>
        setSyncing(s => { const c = { ...s }; delete c[dateKey]; return c; }),
      );

      return updated;
    });
  }, [todayKey]);

  // ── Build 7-day week strip ─────────────────────────────────────────────────
  const today  = new Date();
  const monday = addDays(weekMonday(today), weekOffset * 7);
  const days   = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const weekN  = isoWeekNum(monday);

  const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"] as const;

  return (
    <Panel accent={ACCENT}>
      {/* Header + week nav */}
      <div className="flex items-center mb-[8px]">
        <div className="flex-1">
          <CardHeader title="Habit Tracker" badge={`Week ${weekN}`} />
        </div>
        <div className="flex items-center gap-1 shrink-0 -mt-[2px]">
          <NavBtn onClick={() => setWeekOffset(w => w - 1)} label="‹" />
          {weekOffset < 0 && (
            <NavBtn onClick={() => setWeekOffset(0)} label="·" title="Go to current week" />
          )}
          <NavBtn onClick={() => setWeekOffset(w => Math.min(0, w + 1))} label="›"
            disabled={weekOffset >= 0} />
        </div>
      </div>

      {/* Day header row */}
      <div className="flex gap-1 mb-[7px]">
        <div className="w-[88px] shrink-0" />
        <div className="flex gap-1 flex-1">
          {days.map((d, i) => {
            const dk      = localDateKey(d);
            const isToday = dk === todayKey;
            return (
              <div key={dk} className="flex-1 flex flex-col items-center"
                style={{ maxWidth: "28px" }}>
                <span className="text-[9px] tracking-[0.05em]"
                  style={{ color: isToday ? COL : "var(--ink-2)" }}>
                  {DAY_LABELS[i]}
                </span>
                <span className="text-[8px] font-mono"
                  style={{ color: isToday ? COL : "var(--ink-2)" }}>
                  {d.getDate()}
                </span>
              </div>
            );
          })}
        </div>
        {/* Streak header */}
        <div className="w-[30px] shrink-0 text-right">
          <span className="text-[8px] tracking-[0.04em]"
            style={{ color: "var(--ink-2)" }}>
            STK
          </span>
        </div>
      </div>

      {/* Habit rows */}
      {HABITS.map((habit) => {
        const streak = calcStreak(store, habit.id);
        return (
          <div key={habit.id} className="flex items-center gap-1 mb-[7px] last:mb-0">
            {/* Label */}
            <span className="text-[11px] w-[88px] shrink-0 truncate"
              style={{ color: "var(--ink-1)" }}>
              {habit.label}
            </span>

            {/* 7 cells */}
            <div className="flex gap-1 flex-1">
              {days.map((d) => {
                const dk    = localDateKey(d);
                const state = cellState(store, dk, todayKey, habit.id);
                const isToday = dk === todayKey;
                const isSyncing = syncing[dk] ?? false;

                return (
                  <button
                    key={dk}
                    type="button"
                    onClick={() => toggle(dk, habit.id)}
                    disabled={state === "future"}
                    title={state === "future" ? "" : `${habit.label} · ${dk}`}
                    className="flex-1 rounded-[5px] flex items-center justify-center text-[9px] transition-opacity"
                    style={{
                      maxWidth:    "28px",
                      aspectRatio: "1",
                      opacity:     isSyncing ? 0.7 : 1,
                      outline:     isToday
                        ? `1px solid oklch(70% 0.19 225 / 0.30)`
                        : undefined,
                      outlineOffset: "1px",
                      ...CELL[state],
                    }}
                  >
                    {state === "done" ? "✓" : state === "miss" ? "✗" : ""}
                  </button>
                );
              })}
            </div>

            {/* Streak */}
            <span className="text-[10px] font-mono w-[30px] text-right shrink-0"
              style={{ color: streak > 0 ? COL : "var(--ink-2)" }}>
              {streak > 0
                ? `${streak}${streak >= 3 ? "🔥" : ""}`
                : "–"}
            </span>
          </div>
        );
      })}
    </Panel>
  );
}

// ── Nav button ────────────────────────────────────────────────────────────────

function NavBtn({
  onClick, label, disabled = false, title,
}: {
  onClick:   () => void;
  label:     string;
  disabled?: boolean;
  title?:    string;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title}
      className="w-[20px] h-[20px] rounded-[4px] flex items-center justify-center text-[13px] transition-opacity disabled:opacity-20"
      style={{ background: "var(--surface-2)",
               border:     "1px solid var(--border)",
               color:      "var(--ink-1)" }}>
      {label}
    </button>
  );
}
