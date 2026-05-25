import Panel, { CardHeader } from "./Panel";

const ACCENT = "var(--col-session)";
const COL = "oklch(72% 0.22 290)";

const STATS = [
  { val: "41",   lbl: "Turns" },
  { val: "4.1k", lbl: "Tokens" },
  { val: "14",   lbl: "Tools" },
  { val: "83%",  lbl: "Cache" },
] as const;

const TOOLS = [
  "Bash", "Read", "Edit", "Write", "WebSearch",
  "Agent", "mcp__chrome", "mcp__preview", "TaskCreate",
] as const;

export default function SessionCard() {
  return (
    <Panel accent={ACCENT}>
      <CardHeader title="Session" badge="LIVE" />

      {/* Model row */}
      <div
        className="flex items-center gap-[10px] mb-[14px] pb-[13px]"
        style={{ borderBottom: "1px solid oklch(28% 0.030 255 / 0.55)" }}
      >
        <div
          className="w-[36px] h-[36px] rounded-[10px] shrink-0 flex items-center justify-center text-[17px]"
          style={{
            background: "linear-gradient(135deg, oklch(72% 0.22 290 / 0.28), oklch(72% 0.19 195 / 0.28))",
            border: "1px solid oklch(72% 0.22 290 / 0.30)",
          }}
        >
          ◈
        </div>
        <div>
          <div className="text-[13px] font-semibold mb-[2px]">Claude Sonnet 4.6</div>
          <div className="text-[10px] font-mono" style={{ color: "oklch(42% 0.018 255)" }}>
            claude-sonnet-4-6 · Extended Thinking ON
          </div>
        </div>
        <span
          className="ml-auto text-[9px] font-extrabold px-2 py-[3px] rounded-[20px] tracking-[0.08em] border"
          style={{
            background: "oklch(72% 0.22 290 / 0.10)",
            color: COL,
            borderColor: "oklch(72% 0.22 290 / 0.30)",
          }}
        >
          ACTIVE
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 mb-[13px]">
        {STATS.map((s) => (
          <div key={s.lbl} className="text-center">
            <div className="text-[19px] font-bold font-mono leading-none" style={{ color: COL }}>
              {s.val}
            </div>
            <div
              className="text-[9px] tracking-[0.08em] uppercase mt-[3px]"
              style={{ color: "oklch(42% 0.018 255)" }}
            >
              {s.lbl}
            </div>
          </div>
        ))}
      </div>

      {/* Context bar */}
      <div className="flex justify-between mb-[5px]">
        <span className="text-[10px]" style={{ color: "oklch(42% 0.018 255)" }}>
          Context window used
        </span>
        <span className="text-[10px] font-mono" style={{ color: COL }}>
          37% · 74k / 200k tokens
        </span>
      </div>
      <div
        className="h-1.5 rounded-[3px] overflow-hidden mb-[13px]"
        style={{ background: "oklch(20% 0.025 255 / 0.7)" }}
      >
        <div
          className="h-full w-[37%] rounded-[3px]"
          style={{ background: `linear-gradient(90deg, ${COL}, var(--col-operator))` }}
        />
      </div>

      {/* Active tools */}
      <div
        className="text-[10px] font-bold tracking-[0.12em] uppercase mb-[7px]"
        style={{ color: "oklch(42% 0.018 255)" }}
      >
        Active Tools
      </div>
      <div className="flex flex-wrap gap-[5px]">
        {TOOLS.map((t) => (
          <span
            key={t}
            className="text-[9px] px-[7px] py-[2px] rounded-[5px] font-mono"
            style={{
              background: "oklch(20% 0.025 255 / 0.7)",
              border: "1px solid oklch(28% 0.030 255 / 0.55)",
              color: "oklch(42% 0.018 255)",
            }}
          >
            {t}
          </span>
        ))}
      </div>
    </Panel>
  );
}
