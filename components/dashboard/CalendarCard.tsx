"use client";

import { useEffect, useRef, useState } from "react";
import Panel, { CardHeader } from "./Panel";
import type { CalEvent } from "@/app/api/calendar/route";

// ── Constants ─────────────────────────────────────────────────────────────────

const ACCENT  = "var(--col-calendar)";
const DAY_ABB = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MON_ABB = ["Jan","Feb","Mar","Apr","May","Jun",
                  "Jul","Aug","Sep","Oct","Nov","Dec"] as const;

// ── Utilities ─────────────────────────────────────────────────────────────────

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function localDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours(), m = d.getMinutes();
  const suffix = h >= 12 ? "pm" : "am";
  const hr = h % 12 || 12;
  return m === 0 ? `${hr}${suffix}` : `${hr}:${String(m).padStart(2, "0")}${suffix}`;
}

function fmtShortDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return `${DAY_ABB[d.getDay()]} ${d.getDate()} ${MON_ABB[d.getMonth()] ?? ""}`;
}

function minuteOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

function eventsForDay(events: CalEvent[], dayStr: string): CalEvent[] {
  return events.filter((e) => {
    const start = new Date(e.start);
    const end   = new Date(e.end);
    if (e.allDay) {
      const s  = isoDay(start);
      const en = isoDay(new Date(end.getTime() - 1));
      return dayStr >= s && dayStr <= en;
    }
    return isoDay(localDay(start)) === dayStr;
  });
}

function eventColor(ev: CalEvent): string {
  return ev.color ?? "var(--col-calendar)";
}

// ── DayChip ───────────────────────────────────────────────────────────────────

function DayChip({
  date, isSelected, isToday, count, onClick,
}: {
  date: Date; isSelected: boolean; isToday: boolean; count: number; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-[3px] flex-1 py-2 rounded-[8px] transition-colors"
      style={{
        background: isSelected ? "oklch(72% 0.20 270 / 0.18)" : "transparent",
        border:     isSelected ? "1px solid oklch(72% 0.20 270 / 0.40)" : "1px solid transparent",
      }}
    >
      <span className="text-[9px] font-semibold tracking-[0.08em] uppercase"
        style={{ color: isToday ? ACCENT : "var(--ink-2)" }}>
        {DAY_ABB[date.getDay()]}
      </span>
      <span className="text-[15px] font-bold leading-none"
        style={{ color: isSelected ? ACCENT : isToday ? "var(--ink-0)" : "var(--ink-1)" }}>
        {date.getDate()}
      </span>
      <span className="h-[5px] flex items-center gap-[2px]">
        {count > 0 && (
          <>
            <span className="w-[4px] h-[4px] rounded-full"
              style={{ background: isSelected ? ACCENT : "var(--ink-2)" }} />
            {count > 1 && (
              <span className="w-[4px] h-[4px] rounded-full"
                style={{ background: isSelected ? ACCENT : "var(--ink-2)" }} />
            )}
          </>
        )}
      </span>
    </button>
  );
}

// ── Event rows ────────────────────────────────────────────────────────────────

function AllDayBadge({ ev }: { ev: CalEvent }) {
  const c = eventColor(ev);
  return (
    <div className="flex items-center gap-2 rounded-[6px] px-3 py-[7px] mb-[5px]"
      style={{ background: `${c}18`, border: `1px solid ${c}40`, borderLeft: `3px solid ${c}` }}>
      <span className="text-[9px] font-bold tracking-[0.08em] uppercase shrink-0" style={{ color: c }}>
        ALL DAY
      </span>
      <span className="text-[12px] truncate" style={{ color: "var(--ink-0)" }}>{ev.title}</span>
    </div>
  );
}

function TimedEventRow({ ev }: { ev: CalEvent }) {
  const c = eventColor(ev);
  return (
    <div className="flex gap-2 rounded-[6px] px-3 py-[8px] mb-[5px]"
      style={{ background: "var(--surface-2)",
               border: "1px solid var(--border)", borderLeft: `3px solid ${c}` }}>
      <div className="shrink-0 w-[44px] text-right">
        <span className="text-[10px] font-mono leading-tight block" style={{ color: c }}>
          {fmtTime(ev.start)}
        </span>
        <span className="text-[9px] font-mono leading-tight block" style={{ color: "var(--ink-2)" }}>
          {fmtTime(ev.end)}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium leading-snug truncate" style={{ color: "var(--ink-0)" }}>
          {ev.title}
        </p>
        {ev.location && (
          <p className="text-[10px] truncate mt-[2px]" style={{ color: "var(--ink-2)" }}>
            📍 {ev.location}
          </p>
        )}
      </div>
    </div>
  );
}

// ── NowLine ───────────────────────────────────────────────────────────────────

function NowLine({ ref: r }: { ref: React.RefObject<HTMLDivElement | null> }) {
  const now = new Date();
  return (
    <div ref={r} className="relative flex items-center my-[6px]">
      <div className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: "var(--danger)" }} />
      <div className="flex-1 h-px" style={{ background: "var(--danger)", opacity: 0.7 }} />
      <span className="text-[9px] font-mono ml-1 shrink-0" style={{ color: "var(--danger)" }}>
        {fmtTime(now.toISOString())}
      </span>
    </div>
  );
}

// ── Main card ─────────────────────────────────────────────────────────────────

export default function CalendarCard() {
  const today    = localDay(new Date());
  const todayStr = isoDay(today);

  const [events,      setEvents]      = useState<CalEvent[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string>(todayStr);
  // weekOffset: 0 = this week (today→+6), 1 = next week, etc.
  const [weekOffset,  setWeekOffset]  = useState(0);

  const nowRef  = useRef<HTMLDivElement | null>(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res  = await fetch("/api/calendar");
        const json = (await res.json()) as { events?: CalEvent[]; error?: string };
        if (!cancelled) {
          if (json.error) setError(json.error);
          else setEvents(json.events ?? []);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Auto-scroll NOW into view ────────────────────────────────────────────
  useEffect(() => {
    if (selectedDay === todayStr && !loading) {
      setTimeout(() => nowRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }), 80);
    }
  }, [selectedDay, todayStr, loading]);

  // ── 7-day strip for current week offset ─────────────────────────────────
  const stripStart = addDays(today, weekOffset * 7);
  const days       = Array.from({ length: 7 }, (_, i) => addDays(stripStart, i));

  // ── Events for selected day ───────────────────────────────────────────────
  const dayEvents = eventsForDay(events, selectedDay);
  const allDay    = dayEvents.filter((e) => e.allDay);
  const timed     = dayEvents.filter((e) => !e.allDay)
                             .sort((a, b) => a.start.localeCompare(b.start));
  const nowMins   = minuteOfDay(new Date());

  // ── Next upcoming event (for empty-day hint) ─────────────────────────────
  const nextEvent = events.find((e) => isoDay(localDay(new Date(e.start))) > selectedDay);

  // ── Header badge (month of strip start) ─────────────────────────────────
  const badgeText = `${MON_ABB[stripStart.getMonth()] ?? ""} ${stripStart.getFullYear()}`;

  return (
    <Panel accent={ACCENT}>
      <CardHeader title="Calendar" badge={badgeText} />

      {/* ── Week navigation + 7-day strip ─────────────────────────────── */}
      <div className="flex items-center gap-1 mb-2">
        {/* Prev week */}
        <button
          type="button"
          onClick={() => { setWeekOffset(w => Math.max(0, w - 1)); }}
          disabled={weekOffset === 0}
          className="shrink-0 w-[22px] h-[22px] rounded-[5px] flex items-center justify-center transition-opacity disabled:opacity-25"
          style={{ background: "var(--surface-2)",
                   border:     "1px solid var(--border)",
                   color:      "var(--ink-1)" }}
        >
          ‹
        </button>

        <div className="flex gap-[3px] flex-1">
          {days.map((d) => {
            const ds    = isoDay(d);
            const count = eventsForDay(events, ds).length;
            return (
              <DayChip key={ds} date={d} isSelected={ds === selectedDay}
                isToday={ds === todayStr} count={count}
                onClick={() => setSelectedDay(ds)} />
            );
          })}
        </div>

        {/* Next week (up to 8 weeks out matches 60-day API window) */}
        <button
          type="button"
          onClick={() => setWeekOffset(w => Math.min(8, w + 1))}
          disabled={weekOffset >= 8}
          className="shrink-0 w-[22px] h-[22px] rounded-[5px] flex items-center justify-center transition-opacity disabled:opacity-25"
          style={{ background: "var(--surface-2)",
                   border:     "1px solid var(--border)",
                   color:      "var(--ink-1)" }}
        >
          ›
        </button>
      </div>

      {/* Divider */}
      <div className="h-px mb-3" style={{ background: "var(--border)" }} />

      {/* ── Event list ────────────────────────────────────────────────── */}
      {loading ? (
        <Skeleton />
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <div className="overflow-y-auto" style={{ maxHeight: "280px", scrollbarWidth: "none" }}>
          {allDay.map((ev) => <AllDayBadge key={ev.id} ev={ev} />)}

          {timed.length === 0 && allDay.length === 0 ? (
            <EmptyDay nextEvent={nextEvent} />
          ) : (
            <div className="relative">
              {timed.map((ev, i) => {
                const evMins = minuteOfDay(new Date(ev.start));
                const nextMins = i + 1 < timed.length
                  ? minuteOfDay(new Date(timed[i + 1]!.start))
                  : 24 * 60;
                const showNow = selectedDay === todayStr
                  && nowMins >= evMins
                  && nowMins < nextMins;

                return (
                  <div key={ev.id}>
                    <TimedEventRow ev={ev} />
                    {showNow && <NowLine ref={nowRef} />}
                  </div>
                );
              })}
              {/* NOW at top if before all events */}
              {selectedDay === todayStr && timed.length > 0
                && nowMins < minuteOfDay(new Date(timed[0]!.start)) && (
                <div ref={nowRef} className="relative flex items-center mb-[6px]">
                  <div className="w-[7px] h-[7px] rounded-full shrink-0"
                    style={{ background: "var(--danger)" }} />
                  <div className="flex-1 h-px" style={{ background: "var(--danger)", opacity: 0.7 }} />
                  <span className="text-[9px] font-mono ml-1 shrink-0"
                    style={{ color: "var(--danger)" }}>
                    {fmtTime(new Date().toISOString())}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* NOW marker when no timed events and today selected */}
          {selectedDay === todayStr && timed.length === 0 && allDay.length > 0 && (
            <div ref={nowRef} className="relative flex items-center my-2">
              <div className="w-[7px] h-[7px] rounded-full shrink-0"
                style={{ background: "var(--danger)" }} />
              <div className="flex-1 h-px" style={{ background: "var(--danger)", opacity: 0.7 }} />
              <span className="text-[9px] font-mono ml-1 shrink-0" style={{ color: "var(--danger)" }}>
                {fmtTime(new Date().toISOString())}
              </span>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

// ── Skeleton / empty / error ──────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="flex flex-col gap-2 animate-pulse">
      {[80, 60, 75].map((w) => (
        <div key={w} className="h-[46px] rounded-[6px]"
          style={{ background: "var(--surface-2)", width: `${w}%` }} />
      ))}
    </div>
  );
}

function EmptyDay({ nextEvent }: { nextEvent?: CalEvent }) {
  return (
    <div className="rounded-[8px] px-4 py-4 text-center"
      style={{ background: "var(--surface-2)",
               border: "1px solid var(--border)" }}>
      <div className="text-[20px] mb-1 select-none">🗓</div>
      <p className="text-[11px] font-medium mb-1" style={{ color: "var(--ink-1)" }}>
        Nothing scheduled
      </p>
      {nextEvent ? (
        <p className="text-[10px]" style={{ color: "var(--ink-2)" }}>
          Next: <span style={{ color: "var(--col-calendar)" }}>
            {nextEvent.title}
          </span>
          {" "}on {fmtShortDate(nextEvent.start.slice(0, 10))}
        </p>
      ) : (
        <p className="text-[10px]" style={{ color: "var(--ink-2)" }}>
          Use ‹ › to browse other days
        </p>
      )}
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  const isUnconfigured = message.includes("not configured");
  return (
    <div className="rounded-[8px] px-4 py-4 text-center"
      style={{ background: "var(--surface-2)",
               border: "1px solid var(--border)" }}>
      <div className="text-[18px] mb-1 select-none">{isUnconfigured ? "🔑" : "⚠️"}</div>
      <p className="text-[11px] font-medium mb-1" style={{ color: "var(--ink-1)" }}>
        {isUnconfigured ? "Calendar not connected" : "Could not load calendar"}
      </p>
      <p className="text-[10px]" style={{ color: "var(--ink-2)" }}>
        {isUnconfigured ? "Add GOOGLE_CALENDAR_ICAL_URL to .env.local" : message}
      </p>
    </div>
  );
}
