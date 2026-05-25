import Panel, { CardHeader } from "./Panel";

const ACCENT = "var(--col-nutrition)";
const COL = "oklch(72% 0.19 158)";

const MACROS = [
  { lbl: "Protein", pct: 82, fill: "oklch(72% 0.19 195)", val: "148 / 180g" },
  { lbl: "Carbs",   pct: 65, fill: "oklch(75% 0.18  60)", val: "163 / 250g" },
  { lbl: "Fat",     pct: 74, fill: COL,                   val: "59 / 80g" },
  { lbl: "Fibre",   pct: 47, fill: "oklch(70% 0.19 225)", val: "14 / 30g" },
  { lbl: "Water",   pct: 60, fill: "oklch(68% 0.18 240)", val: "1.8 / 3 L" },
] as const;

const MEALS = [
  { name: "Overnight Oats",        time: "07:15", kcal: "420" },
  { name: "Grilled Chicken Bowl",  time: "12:30", kcal: "680" },
  { name: "Protein Shake",         time: "15:00", kcal: "310" },
  { name: "Greek Salad",           time: "18:45", kcal: "430" },
] as const;

// Calorie ring: r=42, circumference ≈ 263.9, 77% fill → offset = 263.9 * (1-0.77) ≈ 60.7
const R = 42;
const CIRC = 2 * Math.PI * R;
const FILL_PCT = 0.77;
const OFFSET = CIRC * (1 - FILL_PCT);

export default function NutritionCard() {
  return (
    <Panel accent={ACCENT}>
      <CardHeader title="Nutrition" badge="Today" />

      {/* Calorie ring */}
      <div className="flex justify-center mb-[14px]">
        <div className="relative w-[104px] h-[104px]">
          <svg
            width={104}
            height={104}
            viewBox="0 0 104 104"
            style={{ transform: "rotate(-90deg)" }}
            aria-hidden
          >
            <circle
              cx={52} cy={52} r={R}
              fill="none"
              stroke="oklch(20% 0.025 255)"
              strokeWidth={8}
            />
            <circle
              cx={52} cy={52} r={R}
              fill="none"
              stroke={COL}
              strokeWidth={8}
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={OFFSET}
            />
          </svg>
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center"
          >
            <div
              className="text-[21px] font-bold font-mono leading-none"
              style={{ color: COL }}
            >
              1,840
            </div>
            <div className="text-[9px] mt-[1px]" style={{ color: "oklch(42% 0.018 255)" }}>
              kcal
            </div>
          </div>
        </div>
      </div>
      <div
        className="text-center text-[10px] mb-[14px]"
        style={{ color: "oklch(42% 0.018 255)" }}
      >
        of 2,400 target · 560 remaining
      </div>

      {/* Macros */}
      <div className="flex flex-col gap-[7px] mb-[15px]">
        {MACROS.map((m) => (
          <div key={m.lbl} className="flex items-center gap-2">
            <span className="text-[10px] w-[54px] shrink-0" style={{ color: "oklch(62% 0.018 255)" }}>
              {m.lbl}
            </span>
            <div
              className="flex-1 h-[5px] rounded-[3px] overflow-hidden"
              style={{ background: "oklch(20% 0.025 255 / 0.7)" }}
            >
              <div
                className="h-full rounded-[3px]"
                style={{ width: `${m.pct}%`, background: m.fill }}
              />
            </div>
            <span
              className="text-[10px] font-mono w-[52px] text-right shrink-0"
              style={{ color: "oklch(62% 0.018 255)" }}
            >
              {m.val}
            </span>
          </div>
        ))}
      </div>

      {/* Meal log */}
      <div style={{ borderTop: "1px solid oklch(28% 0.030 255 / 0.55)", paddingTop: "12px" }}>
        <div
          className="text-[9px] font-bold tracking-[0.12em] uppercase mb-2"
          style={{ color: "oklch(42% 0.018 255)" }}
        >
          Meal Log
        </div>
        {MEALS.map((meal, i) => (
          <div
            key={meal.name}
            className="flex items-center justify-between py-1.5"
            style={
              i < MEALS.length - 1
                ? { borderBottom: "1px solid oklch(28% 0.025 255 / 0.35)" }
                : undefined
            }
          >
            <div>
              <div className="text-[11px]" style={{ color: "oklch(62% 0.018 255)" }}>
                {meal.name}
              </div>
              <div className="text-[9px] font-mono mt-[1px]" style={{ color: "oklch(42% 0.018 255)" }}>
                {meal.time}
              </div>
            </div>
            <span className="text-[12px] font-mono font-semibold" style={{ color: COL }}>
              {meal.kcal}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
