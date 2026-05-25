import Panel, { CardHeader } from "./Panel";

const ACCENT = "var(--col-finance)";
const COL = "oklch(72% 0.19 145)";

type Trend = "up" | "dn" | "flat";

const ROWS: { label: string; value: string; trend: Trend }[] = [
  { label: "Equities",    value: "$187,400 ▲", trend: "up" },
  { label: "Crypto",      value: "$34,200 ▲",  trend: "up" },
  { label: "Cash",        value: "$27,131 —",  trend: "flat" },
  { label: "30 d return", value: "+8.4%",      trend: "up" },
];

const TREND_COLOR: Record<Trend, string> = {
  up:   "oklch(72% 0.19 145)",
  dn:   "oklch(68% 0.22  25)",
  flat: "var(--ink-0)",
};

export default function FinancePulseCard() {
  return (
    <Panel accent={ACCENT}>
      <CardHeader title="Finance Pulse" badge="Live" />

      <div
        className="text-[27px] font-bold font-mono tracking-[-0.02em] leading-none"
        style={{ color: "var(--ink-0)" }}
      >
        $248,731
      </div>
      <div className="flex items-center gap-1.5 mt-1 mb-[10px]">
        <span className="text-[12px] font-semibold font-mono" style={{ color: COL }}>
          ▲ +$3,204 · +1.31%
        </span>
        <span className="text-[10px]" style={{ color: "oklch(42% 0.018 255)" }}>today</span>
      </div>

      {/* Sparkline */}
      <svg
        className="w-full mb-[10px]"
        viewBox="0 0 240 38"
        preserveAspectRatio="none"
        height={38}
        aria-hidden
      >
        <defs>
          <linearGradient id="sparkline-grad-finance" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={COL} stopOpacity={0.35} />
            <stop offset="100%" stopColor={COL} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path
          d="M0,29 L25,27 L45,25 L65,28 L85,21 L105,23 L120,17 L140,19 L160,13 L180,10 L200,8 L220,6 L240,4 L240,38 L0,38Z"
          fill="url(#sparkline-grad-finance)"
        />
        <path
          d="M0,29 L25,27 L45,25 L65,28 L85,21 L105,23 L120,17 L140,19 L160,13 L180,10 L200,8 L220,6 L240,4"
          fill="none"
          stroke={COL}
          strokeWidth={1.6}
          strokeLinejoin="round"
        />
      </svg>

      <div className="flex flex-col gap-1.5">
        {ROWS.map((row) => (
          <div key={row.label} className="flex justify-between">
            <span className="text-[11px]" style={{ color: "oklch(62% 0.018 255)" }}>
              {row.label}
            </span>
            <span
              className="text-[11px] font-mono font-medium"
              style={{ color: TREND_COLOR[row.trend] }}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
