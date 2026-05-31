import { type NextRequest, NextResponse } from "next/server";
import ICAL from "ical.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CalEvent {
  id:          string;
  title:       string;
  start:       string;   // ISO-8601
  end:         string;   // ISO-8601
  allDay:      boolean;
  location:    string | null;
  description: string | null;
  color:       string | null;
}

// ── Module-level cache (5-minute TTL) ────────────────────────────────────────

interface Cache {
  events: CalEvent[];
  ts:     number;
}

let _cache: Cache | null = null;
const TTL_MS = 5 * 60 * 1000;

// ── iCal parsing ──────────────────────────────────────────────────────────────

function parseICS(icsText: string, windowStart: Date, windowEnd: Date): CalEvent[] {
  const jCal    = ICAL.parse(icsText);
  const comp    = new ICAL.Component(jCal);
  const vevents = comp.getAllSubcomponents("vevent");

  const wsTime = ICAL.Time.fromJSDate(windowStart, false);
  const weTime = ICAL.Time.fromJSDate(windowEnd,   false);

  const events: CalEvent[] = [];

  for (const vevent of vevents) {
    try {
      const event = new ICAL.Event(vevent, { strictExceptions: false });

      // Skip events with no start date
      if (!event.startDate) continue;

      if (event.isRecurring()) {
        // Iterate from the event's own start (NOT wsTime) so ical.js doesn't get
        // confused; we manually skip occurrences that fall before the window.
        const iter    = event.iterator();
        let   safety  = 0;         // guard against infinite loops

        // eslint-disable-next-line no-constant-condition
        while (true) {
          if (iter.complete || ++safety > 1000) break;

          // iter.next() returns ICAL.Time, null, OR undefined when exhausted
          const next: ICAL.Time | null | undefined = iter.next();
          if (!next) break;

          if (next.compare(weTime) > 0) break;   // past our window → done
          if (next.compare(wsTime) < 0) continue; // before window → skip

          try {
            const occ    = event.getOccurrenceDetails(next);
            const oStart = occ.startDate;
            // endDate may be absent when the event uses DURATION; fall back to start
            const oEnd   = occ.endDate ?? oStart;

            events.push(toCalEvent(
              `${event.uid}-${next.toUnixTime()}`,
              occ.item.summary     || event.summary,
              occ.item.location    || event.location,
              occ.item.description || event.description,
              occ.item.color       || event.color,
              oStart,
              oEnd,
            ));
          } catch {
            // Skip malformed individual occurrence
          }
        }
      } else {
        // Non-recurring: include if it overlaps the window
        const start = event.startDate;
        // endDate absent when event uses DURATION; fall back to start
        const end   = event.endDate ?? start;

        if (start.compare(weTime) <= 0 && end.compare(wsTime) >= 0) {
          events.push(toCalEvent(
            event.uid,
            event.summary,
            event.location,
            event.description,
            event.color,
            start,
            end,
          ));
        }
      }
    } catch {
      // Skip entirely malformed VEVENT components
    }
  }

  // Sort ascending by start time
  events.sort((a, b) => a.start.localeCompare(b.start));
  return events;
}

function toCalEvent(
  id:          string,
  summary:     string,
  location:    string,
  description: string,
  color:       string,
  startTime:   ICAL.Time,
  endTime:     ICAL.Time,
): CalEvent {
  return {
    id,
    title:       summary     || "(No title)",
    location:    location    || null,
    description: description || null,
    color:       color       || null,
    allDay:      startTime.isDate,
    start:       startTime.toJSDate().toISOString(),
    end:         endTime.toJSDate().toISOString(),
  };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest): Promise<NextResponse> {
  const icalUrl = process.env.GOOGLE_CALENDAR_ICAL_URL;
  if (!icalUrl) {
    return NextResponse.json(
      { error: "GOOGLE_CALENDAR_ICAL_URL not configured" },
      { status: 503 },
    );
  }

  // Serve from cache if fresh
  if (_cache && Date.now() - _cache.ts < TTL_MS) {
    return NextResponse.json(
      { events: _cache.events, cached: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  // 60-day window: today 00:00 → today+60 23:59
  // Wide enough to catch sparse calendars while staying fast to iterate.
  const windowStart = new Date();
  windowStart.setHours(0, 0, 0, 0);
  const windowEnd = new Date(windowStart);
  windowEnd.setDate(windowEnd.getDate() + 60);
  windowEnd.setHours(23, 59, 59, 999);

  try {
    const res = await fetch(icalUrl, {
      headers: { "User-Agent": "TimsBrain/1.0 (ical-fetcher)" },
      // Always bypass Next.js fetch cache — module cache is our own TTL layer
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`iCal fetch failed: ${res.status} ${res.statusText}`);
    }

    const icsText = await res.text();
    const events  = parseICS(icsText, windowStart, windowEnd);

    _cache = { events, ts: Date.now() };

    return NextResponse.json(
      { events, cached: false },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("[api/calendar]", err);
    // Return stale cache if available rather than an error
    if (_cache) {
      return NextResponse.json(
        { events: _cache.events, cached: true, stale: true },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
