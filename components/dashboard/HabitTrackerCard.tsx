import Panel, { CardHeader } from "./Panel";

const ACCENT = "var(--col-habits)";
const COL = "oklch(70% 0.19 225)";

type HabitState = "done" | "miss" | "todo";

interface Habit {
  name: string;
  days: HabitState[];
  streak: string;
}

const HABITS: Habit[] = [
  { name: "Morning Run",  days: ["done","done","done","miss","done","done","todo"], streak: "5🔥" },
  { name: "Deep Work",    days: ["done","done","done","done","done","todo","todo"], streak: "5🔥" },
  { name: "Meditation",   days: ["done","miss","done","done","done","done","todo"], streak: "4🔥" },
  { name: "No Alcohol",   days: ["done","done","done","done","done","miss","todo"], streak: "4" },
  { name: "Cold Shower",  days: ["done","done","done","done","done","done","todo"], streak: "6🔥" },
  { name: "Read 30 min",  days: ["done","done","miss","done","done","done","todo"], streak: "4🔥" },
];

const CELL_STYLE: Record<HabitState, { background: string; border: string; color: string }> = {
  done: {
    background: "oklch(70% 0.19 225 / 0.22)",
    border: "1px solid oklch(70% 0.19 225 / 0.42)",
    color: COL,
  },
  miss: {
    background: "oklch(19% 0.02 255 / 0.6)",
    border: "1px solid oklch(28% 0.02 255 / 0.5)",
    color: "oklch(42% 0.018 255)",
  },
  todo: {
    background: "oklch(20% 0.025 255 / 0.35)",
    border: "1px dashed oklch(30% 0.025 255 / 0.4)",
    color: "transparent",
  },
};

export default function HabitTrackerCard() {
  return (
    <Panel accent={ACCENT}>
      <CardHeader title="Habit Tracker" badge="Week 21" />

      {/* Day labels row */}
      <div className="flex gap-1 mb-[7px]">
        <div className="w-[88px] shrink-0" />
        <div className="flex gap-1 flex-1">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <span
              key={i}
              className="flex-1 text-center text-[9px] tracking-[0.05em]"
              style={{ maxWidth: "28px", color: "oklch(42% 0.018 255)" }}
            >
              {d}
            </span>
          ))}
        </div>
        <div className="w-[30px] shrink-0" />
      </div>

      {/* Habit rows */}
      {HABITS.map((habit) => (
        <div key={habit.name} className="flex items-center gap-1 mb-[7px] last:mb-0">
          <span
            className="text-[11px] w-[88px] shrink-0"
            style={{ color: "oklch(62% 0.018 255)" }}
          >
            {habit.name}
          </span>
          <div className="flex gap-1 flex-1">
            {habit.days.map((state, i) => {
              const s = CELL_STYLE[state];
              return (
                <div
                  key={i}
                  className="flex-1 rounded-[5px] flex items-center justify-center text-[9px]"
                  style={{
                    maxWidth: "28px",
                    aspectRatio: "1",
                    background: s.background,
                    border: s.border,
                    color: s.color,
                  }}
                >
                  {state === "done" ? "✓" : state === "miss" ? "✗" : ""}
                </div>
              );
            })}
          </div>
          <span
            className="text-[10px] font-mono w-[30px] text-right shrink-0"
            style={{ color: COL }}
          >
            {habit.streak}
          </span>
        </div>
      ))}
    </Panel>
  );
}
