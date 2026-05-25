import Panel, { CardHeader } from "./Panel";

const ACCENT = "var(--col-operator)";

const METRICS = [
  { val: "2,847", lbl: "Tokens In" },
  { val: "1,203", lbl: "Tokens Out" },
  { val: "14",    lbl: "Tool Calls" },
  { val: "0.42s", lbl: "Avg Latency" },
] as const;

const BARS = [
  { label: "Cache Hit Rate", pct: 83, display: "83%" },
  { label: "Context Window", pct: 37, display: "37%" },
] as const;

export default function OperatorCard() {
  return (
    <Panel accent={ACCENT}>
      <CardHeader title="Operator" badge="claude-sonnet-4-6" />

      {/* Status row */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className="w-[7px] h-[7px] rounded-full shrink-0"
          style={{
            background: ACCENT,
            boxShadow: `0 0 7px ${ACCENT}`,
            animation: "pulse-dot 2.2s ease-in-out infinite",
          }}
        />
        <span className="text-[12px] font-semibold" style={{ color: ACCENT }}>
          Active Session
        </span>
        <span className="ml-auto text-[10px] font-mono" style={{ color: "oklch(42% 0.018 255)" }}>
          API v2026.5
        </span>
      </div>

      {/* Metric tiles */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {METRICS.map((m) => (
          <div
            key={m.lbl}
            className="rounded-[8px] px-[10px] py-[9px]"
            style={{
              background: "oklch(20% 0.025 255 / 0.65)",
              border: "1px solid oklch(28% 0.030 255 / 0.55)",
            }}
          >
            <div
              className="text-[19px] font-bold font-mono leading-none mb-[3px]"
              style={{ color: "var(--accent)" }}
            >
              {m.val}
            </div>
            <div className="text-[9px] tracking-[0.06em]" style={{ color: "oklch(42% 0.018 255)" }}>
              {m.lbl}
            </div>
          </div>
        ))}
      </div>

      {/* Bars */}
      {BARS.map((bar, i) => (
        <div key={bar.label} className={i > 0 ? "mt-1" : ""}>
          <div
            className="flex justify-between text-[10px] mb-[5px]"
            style={{ color: "oklch(42% 0.018 255)" }}
          >
            <span>{bar.label}</span>
            <span className="font-mono" style={{ color: "var(--accent)" }}>
              {bar.display}
            </span>
          </div>
          <div
            className="h-1 rounded-[3px] overflow-hidden mb-2"
            style={{ background: "oklch(20% 0.025 255 / 0.7)" }}
          >
            <div
              className="h-full rounded-[3px]"
              style={{ width: `${bar.pct}%`, background: "var(--accent)" }}
            />
          </div>
        </div>
      ))}
    </Panel>
  );
}
