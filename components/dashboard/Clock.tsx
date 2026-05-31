"use client";

import { useEffect, useState } from "react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

interface Tick {
  time: string;
  date: string;
}

function snapshot(): Tick {
  const d = new Date();
  const day   = DAYS[d.getDay()]   ?? "---";
  const month = MONTHS[d.getMonth()] ?? "---";
  return {
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
    date: `${day}, ${pad(d.getDate())} ${month} ${d.getFullYear()}`,
  };
}

export default function Clock() {
  const [{ time, date }, setState] = useState<Tick>(snapshot);

  useEffect(() => {
    const id = setInterval(() => setState(snapshot()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="text-right">
      <div
        suppressHydrationWarning
        className="text-base font-semibold tracking-[0.04em]"
        style={{ fontFamily: "var(--font-geist-mono, monospace)", color: "var(--ink-0)" }}
      >
        {time}
      </div>
      <div
        suppressHydrationWarning
        className="text-[10px] tracking-[0.07em] uppercase"
        style={{ color: "var(--ink-2)" }}
      >
        {date}
      </div>
    </div>
  );
}
