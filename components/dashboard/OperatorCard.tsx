import Panel, { CardHeader } from "./Panel";
import { operator } from "@/config/operator";

const ACCENT = "var(--col-operator)";

export default function OperatorCard() {
  return (
    <Panel accent={ACCENT}>
      <CardHeader title="Operator" badge="PROFILE" />

      {/* Identity row */}
      <div className="flex items-center gap-3 mb-4">
        {/* Avatar */}
        <div
          className="w-10 h-10 rounded-[10px] shrink-0 flex items-center justify-center text-[15px] font-bold select-none"
          style={{
            background: `linear-gradient(135deg, color-mix(in oklch, var(--col-operator) 25%, transparent), color-mix(in oklch, var(--col-session) 25%, transparent))`,
            border:     "1px solid color-mix(in oklch, var(--col-operator) 35%, transparent)",
            color:      ACCENT,
          }}
        >
          {operator.initials}
        </div>

        <div className="min-w-0">
          <div className="text-[15px] font-semibold leading-tight truncate">
            {operator.name}
          </div>
          <div
            className="text-[11px] mt-[2px] truncate"
            style={{ color: "var(--ink-2)" }}
          >
            {operator.role}
          </div>
        </div>

        {/* Online indicator */}
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <span
            className="w-[7px] h-[7px] rounded-full"
            style={{
              background: ACCENT,
              boxShadow:  `0 0 7px ${ACCENT}`,
              animation:  "pulse-dot 2.2s ease-in-out infinite",
            }}
          />
          <span className="text-[10px] font-semibold" style={{ color: ACCENT }}>
            Online
          </span>
        </div>
      </div>

      {/* Divider */}
      <div
        className="h-px mb-4"
        style={{ background: "var(--border)" }}
      />

      {/* Location + timezone */}
      <div className="flex flex-col gap-[10px] mb-4">
        <Row icon="📍" label="Location" value={operator.location} accent={ACCENT} />
        <Row icon="🕐" label="Timezone" value={operator.timezone} accent={ACCENT} />
      </div>

      {/* Divider */}
      <div
        className="h-px mb-4"
        style={{ background: "var(--border)" }}
      />

      {/* Current focus */}
      <div
        className="text-[10px] font-bold tracking-[0.10em] uppercase mb-2"
        style={{ color: "var(--ink-2)" }}
      >
        Current Focus
      </div>
      <div
        className="rounded-[8px] px-3 py-[10px] mb-3"
        style={{
          background:  "color-mix(in oklch, var(--col-operator) 8%, transparent)",
          border:      "1px solid color-mix(in oklch, var(--col-operator) 22%, transparent)",
          borderLeft:  `3px solid ${ACCENT}`,
        }}
      >
        <p className="text-[12px] leading-snug" style={{ color: "var(--ink-0)" }}>
          {operator.focus}
        </p>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-[5px]">
        {operator.tags.map((tag) => (
          <span
            key={tag}
            className="text-[9px] px-[8px] py-[3px] rounded-[5px] font-mono"
            style={{
              background:  "var(--surface-2)",
              border:      "1px solid var(--border)",
              color:       "var(--ink-2)",
            }}
          >
            #{tag}
          </span>
        ))}
      </div>
    </Panel>
  );
}

// ── Row helper ────────────────────────────────────────────────────────────────

function Row({
  icon,
  label,
  value,
  accent,
}: {
  icon:   string;
  label:  string;
  value:  string;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[13px] select-none w-5 text-center">{icon}</span>
      <span
        className="text-[10px] tracking-[0.06em] uppercase w-[58px] shrink-0"
        style={{ color: "var(--ink-2)" }}
      >
        {label}
      </span>
      <span
        className="text-[12px] font-medium truncate"
        style={{ color: accent }}
      >
        {value}
      </span>
    </div>
  );
}
