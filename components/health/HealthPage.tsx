"use client";

import { useEffect, useState } from "react";
import type { NutritionDay, Meal } from "@/app/api/nutrition/route";

// ── Colours (match NutritionCard) ─────────────────────────────────────────────
const COL_KCAL    = "oklch(72% 0.19 158)";   // --col-nutrition
const COL_PROTEIN = "oklch(72% 0.19 195)";
const COL_CARBS   = "oklch(80% 0.17  70)";
const COL_FAT     = "oklch(72% 0.19 158)";

// ── Formatting helpers ─────────────────────────────────────────────────────────

function fmtKcal(n: number)  { return n > 0 ? n.toLocaleString() : "—"; }
function fmtMacro(n: number) { return n > 0 ? `${Math.round(n)}g` : "—"; }

function fmtDate(iso: string): { primary: string; secondary: string } {
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const todayStr     = today.toISOString().slice(0, 10);
  const yesterStr    = yesterday.toISOString().slice(0, 10);

  if (iso === todayStr)   return { primary: "Today",     secondary: "" };
  if (iso === yesterStr)  return { primary: "Yesterday", secondary: "" };

  const d   = new Date(`${iso}T00:00:00`);
  const day = d.toLocaleDateString("en-GB", { weekday: "short" });
  const mon = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return { primary: mon, secondary: day };
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: {
  label: string; value: string; sub?: string; color: string;
}) {
  return (
    <div
      className="flex flex-col gap-[3px] px-5 py-4 rounded-[12px]"
      style={{
        background:   "oklch(16% 0.028 255 / 0.55)",
        border:       `1px solid ${color}33`,
        borderTop:    `2px solid ${color}`,
        backdropFilter: "blur(12px)",
      }}
    >
      <span className="text-[9px] font-bold tracking-[0.12em] uppercase"
            style={{ color: "oklch(42% 0.018 255)" }}>
        {label}
      </span>
      <span className="text-[22px] font-bold font-mono leading-none" style={{ color }}>
        {value}
      </span>
      {sub && (
        <span className="text-[10px]" style={{ color: "oklch(55% 0.018 255)" }}>{sub}</span>
      )}
    </div>
  );
}

// ── Expanded meal sub-rows ─────────────────────────────────────────────────────

function MealRows({ meals }: { meals: Meal[] }) {
  return (
    <tr>
      <td colSpan={7} className="p-0">
        <div
          style={{
            background:   "oklch(13% 0.022 255 / 0.6)",
            borderBottom: "1px solid oklch(28% 0.025 255 / 0.45)",
          }}
        >
          {/* Sub-header */}
          <div
            className="grid text-[9px] font-bold tracking-[0.10em] uppercase px-5 py-[6px]"
            style={{
              gridTemplateColumns: "50px 1fr 80px 72px 72px 72px",
              color: "oklch(40% 0.018 255)",
              borderBottom: "1px solid oklch(25% 0.025 255 / 0.4)",
            }}
          >
            <span>Time</span>
            <span>Meal</span>
            <span className="text-right">Kcal</span>
            <span className="text-right">Protein</span>
            <span className="text-right">Carbs</span>
            <span className="text-right">Fat</span>
          </div>

          {/* Meal rows */}
          {meals.map(m => (
            <div
              key={m.id}
              className="grid items-center px-5 py-[7px]"
              style={{
                gridTemplateColumns: "50px 1fr 80px 72px 72px 72px",
                borderBottom: "1px solid oklch(22% 0.022 255 / 0.5)",
              }}
            >
              <span className="text-[11px] font-mono" style={{ color: "oklch(45% 0.018 255)" }}>
                {m.t}
              </span>
              <span className="text-[12px] truncate pr-3" style={{ color: "var(--ink-1)" }}>
                {m.estimated && (
                  <span className="mr-[4px] text-[9px]" style={{ color: COL_KCAL }}>✦</span>
                )}
                {m.n}
              </span>
              <span className="text-[12px] font-mono text-right font-semibold"
                    style={{ color: COL_KCAL }}>
                {m.kcal > 0 ? m.kcal.toLocaleString() : "—"}
              </span>
              <span className="text-[12px] font-mono text-right"
                    style={{ color: COL_PROTEIN }}>
                {m.p > 0 ? `${m.p.toFixed(1)}g` : "—"}
              </span>
              <span className="text-[12px] font-mono text-right"
                    style={{ color: COL_CARBS }}>
                {m.c > 0 ? `${m.c.toFixed(1)}g` : "—"}
              </span>
              <span className="text-[12px] font-mono text-right"
                    style={{ color: COL_FAT }}>
                {m.f > 0 ? `${m.f.toFixed(1)}g` : "—"}
              </span>
            </div>
          ))}
        </div>
      </td>
    </tr>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

type WindowDays = 30 | 60 | 90;

export default function HealthPage() {
  const [data,      setData]      = useState<NutritionDay[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [window,    setWindow]    = useState<WindowDays>(30);
  const [expandedDate, setExpanded] = useState<string | null>(null);

  async function load(days: WindowDays) {
    setLoading(true);
    try {
      const res  = await fetch(`/api/nutrition?days=${days}`);
      const json = await res.json() as { days?: NutritionDay[] };
      setData(json.days ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(window); }, [window]);

  // ── Computed averages (exclude zero-meal days) ─────────────────────────────
  const logged = data.filter(d => d.meals.length > 0);
  const n      = logged.length;
  const avg    = n === 0
    ? { kcal: 0, p: 0, c: 0, f: 0 }
    : {
        kcal: Math.round(logged.reduce((s, d) => s + d.totals.kcal, 0) / n),
        p:    Math.round(logged.reduce((s, d) => s + d.totals.p,    0) / n),
        c:    Math.round(logged.reduce((s, d) => s + d.totals.c,    0) / n),
        f:    Math.round(logged.reduce((s, d) => s + d.totals.f,    0) / n),
      };

  const subLabel = `avg over ${n} of ${data.length} days`;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 min-h-0">

      {/* Page header */}
      <div className="flex items-end justify-between">
        <div>
          <h1
            className="text-[22px] font-extrabold tracking-[0.04em] leading-none"
            style={{
              background:            `linear-gradient(90deg, var(--ink-0), ${COL_KCAL})`,
              WebkitBackgroundClip:  "text",
              WebkitTextFillColor:   "transparent",
              backgroundClip:        "text",
            }}
          >
            Health
          </h1>
          <p className="text-[12px] mt-[4px]" style={{ color: "var(--ink-2)" }}>
            Nutrition history · {window}-day window
          </p>
        </div>

        {/* Window selector */}
        <div
          className="flex gap-[3px] p-[3px] rounded-[9px]"
          style={{ background: "oklch(18% 0.022 255 / 0.7)", border: "1px solid oklch(28% 0.030 255 / 0.45)" }}
        >
          {([30, 60, 90] as WindowDays[]).map(d => (
            <button
              key={d}
              onClick={() => { setWindow(d); setExpanded(null); }}
              className="px-[12px] py-[5px] rounded-[6px] text-[12px] font-medium transition-all"
              style={
                window === d
                  ? { background: "oklch(25% 0.030 255 / 0.9)", color: "var(--ink-0)", border: `1px solid ${COL_KCAL}44` }
                  : { background: "transparent", color: "var(--ink-2)", border: "1px solid transparent" }
              }
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Averages bar */}
      {!loading && (
        <div className="grid grid-cols-5 gap-3">
          <StatCard label="Avg Kcal"    value={n ? avg.kcal.toLocaleString() : "—"} sub={subLabel} color={COL_KCAL} />
          <StatCard label="Avg Protein" value={n ? `${avg.p}g` : "—"}              sub={subLabel} color={COL_PROTEIN} />
          <StatCard label="Avg Carbs"   value={n ? `${avg.c}g` : "—"}              sub={subLabel} color={COL_CARBS} />
          <StatCard label="Avg Fat"     value={n ? `${avg.f}g` : "—"}              sub={subLabel} color={COL_FAT} />
          <StatCard
            label="Days Logged"
            value={`${n} / ${data.length}`}
            sub={`${data.length - n} skipped`}
            color="var(--col-session)"
          />
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="flex items-center justify-center py-20" style={{ color: "var(--ink-2)" }}>
          <span className="text-[13px]">Loading…</span>
        </div>
      )}

      {/* Table */}
      {!loading && (
        <div
          className="rounded-[14px] overflow-hidden"
          style={{
            background:   "oklch(16% 0.028 255 / 0.55)",
            border:       "1px solid oklch(28% 0.030 255 / 0.55)",
            backdropFilter: "blur(18px)",
          }}
        >
          <table className="w-full border-collapse">
            {/* Sticky header */}
            <thead>
              <tr
                style={{
                  background:   "oklch(20% 0.028 255 / 0.85)",
                  borderBottom: "1px solid oklch(30% 0.025 255 / 0.55)",
                }}
              >
                {[
                  { label: "Date",    w: "160px",  align: "left"  },
                  { label: "Kcal",    w: "90px",   align: "right" },
                  { label: "Protein", w: "88px",   align: "right" },
                  { label: "Carbs",   w: "88px",   align: "right" },
                  { label: "Fat",     w: "80px",   align: "right" },
                  { label: "Meals",   w: "70px",   align: "right" },
                  { label: "",        w: "40px",   align: "center"},
                ].map(col => (
                  <th
                    key={col.label}
                    className="text-[9px] font-bold tracking-[0.10em] uppercase px-4 py-[11px]"
                    style={{
                      color:     "oklch(45% 0.018 255)",
                      width:     col.w,
                      textAlign: col.align as React.CSSProperties["textAlign"],
                    }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {data.map((day, i) => {
                const hasData   = day.meals.length > 0;
                const isOpen    = expandedDate === day.date;
                const { primary, secondary } = fmtDate(day.date);
                const isLast    = i === data.length - 1;

                return (
                  <>
                    <tr
                      key={day.date}
                      onClick={() => hasData && setExpanded(isOpen ? null : day.date)}
                      style={{
                        borderBottom: isLast && !isOpen
                          ? "none"
                          : `1px solid oklch(${isOpen ? "30% 0.025 255 / 0.60" : "24% 0.022 255 / 0.45"})`,
                        background:   isOpen
                          ? "oklch(20% 0.025 255 / 0.80)"
                          : "transparent",
                        cursor:       hasData ? "pointer" : "default",
                        transition:   "background 0.1s ease",
                      }}
                      onMouseEnter={e => {
                        if (hasData && !isOpen)
                          (e.currentTarget as HTMLElement).style.background = "oklch(19% 0.025 255 / 0.6)";
                      }}
                      onMouseLeave={e => {
                        if (!isOpen)
                          (e.currentTarget as HTMLElement).style.background = "transparent";
                      }}
                    >
                      {/* Date cell */}
                      <td className="px-4 py-[11px]">
                        <div className="flex items-baseline gap-[5px]">
                          <span
                            className="text-[13px] font-medium"
                            style={{ color: hasData ? "var(--ink-0)" : "var(--ink-2)" }}
                          >
                            {primary}
                          </span>
                          {secondary && (
                            <span className="text-[10px]" style={{ color: "oklch(42% 0.018 255)" }}>
                              {secondary}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Kcal */}
                      <td className="px-4 py-[11px] text-right">
                        <span
                          className="text-[13px] font-mono font-semibold"
                          style={{ color: hasData ? COL_KCAL : "oklch(32% 0.018 255)" }}
                        >
                          {fmtKcal(day.totals.kcal)}
                        </span>
                      </td>

                      {/* Protein */}
                      <td className="px-4 py-[11px] text-right">
                        <span className="text-[13px] font-mono"
                              style={{ color: hasData ? COL_PROTEIN : "oklch(32% 0.018 255)" }}>
                          {fmtMacro(day.totals.p)}
                        </span>
                      </td>

                      {/* Carbs */}
                      <td className="px-4 py-[11px] text-right">
                        <span className="text-[13px] font-mono"
                              style={{ color: hasData ? COL_CARBS : "oklch(32% 0.018 255)" }}>
                          {fmtMacro(day.totals.c)}
                        </span>
                      </td>

                      {/* Fat */}
                      <td className="px-4 py-[11px] text-right">
                        <span className="text-[13px] font-mono"
                              style={{ color: hasData ? COL_FAT : "oklch(32% 0.018 255)" }}>
                          {fmtMacro(day.totals.f)}
                        </span>
                      </td>

                      {/* Meal count */}
                      <td className="px-4 py-[11px] text-right">
                        {hasData ? (
                          <span
                            className="text-[11px] font-mono px-[7px] py-[2px] rounded-[20px]"
                            style={{
                              background: `${COL_KCAL}18`,
                              color:       COL_KCAL,
                              border:      `1px solid ${COL_KCAL}30`,
                            }}
                          >
                            {day.meals.length}
                          </span>
                        ) : (
                          <span className="text-[11px]" style={{ color: "oklch(32% 0.018 255)" }}>0</span>
                        )}
                      </td>

                      {/* Chevron */}
                      <td className="px-4 py-[11px] text-center">
                        {hasData && (
                          <span
                            className="text-[10px] inline-block"
                            style={{
                              color:     COL_KCAL,
                              opacity:   0.7,
                              transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                              transition: "transform 0.2s ease",
                              display:   "inline-block",
                            }}
                          >
                            ▾
                          </span>
                        )}
                      </td>
                    </tr>

                    {/* Expanded meal rows */}
                    {isOpen && <MealRows key={`${day.date}-meals`} meals={day.meals} />}
                  </>
                );
              })}
            </tbody>
          </table>

          {/* Empty state */}
          {data.every(d => d.meals.length === 0) && (
            <div className="text-center py-16" style={{ color: "var(--ink-2)" }}>
              <div className="text-[28px] mb-2">🥗</div>
              <div className="text-[13px]">No meals logged in the past {window} days.</div>
              <div className="text-[11px] mt-1" style={{ color: "oklch(40% 0.018 255)" }}>
                Use the Nutrition card on the home dashboard to log meals.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
