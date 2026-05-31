import Panel, { CardHeader } from "./Panel";

const ACCENT = "var(--col-blockers)";

type Severity = "crit" | "high" | "med";

interface Blocker {
  severity: Severity;
  title: string;
  body: string;
}

const BLOCKERS: Blocker[] = [];

const TAG_STYLES: Record<Severity, { bg: string; color: string; border: string; label: string }> = {
  crit: {
    bg: "oklch(68% 0.22 25 / 0.18)", color: "oklch(68% 0.22 25)",
    border: "oklch(68% 0.22 25 / 0.30)", label: "CRIT",
  },
  high: {
    bg: "oklch(75% 0.18 60 / 0.18)", color: "oklch(75% 0.18 60)",
    border: "oklch(75% 0.18 60 / 0.30)", label: "HIGH",
  },
  med: {
    bg: "oklch(70% 0.18 225 / 0.18)", color: "oklch(70% 0.18 225)",
    border: "oklch(70% 0.18 225 / 0.30)", label: "MED",
  },
};

export default function KeyBlockersCard() {
  return (
    <Panel accent={ACCENT}>
      <CardHeader title="Key Blockers" badge={BLOCKERS.length > 0 ? `${BLOCKERS.length} Active` : "Clear"} />

      {BLOCKERS.length === 0 ? (
        <div
          className="rounded-[9px] px-4 py-5 text-center"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
        >
          <div className="text-[22px] mb-2 select-none">🛡️</div>
          <div className="text-[12px] font-medium mb-1" style={{ color: "var(--ink-1)" }}>
            No blockers
          </div>
          <div className="text-[10px]" style={{ color: "var(--ink-2)" }}>
            Nothing flagged as blocked right now.
          </div>
        </div>
      ) : (
      <div className="flex flex-col gap-2">
        {BLOCKERS.map((b) => {
          const tag = TAG_STYLES[b.severity];
          return (
            <div
              key={b.title}
              className="flex items-start gap-[9px] rounded-[9px] px-[10px] py-[9px]"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
              }}
            >
              <span
                className="text-[8px] font-extrabold px-[5px] py-[2px] rounded-[4px] tracking-[0.06em] shrink-0 mt-[1px] border"
                style={{ background: tag.bg, color: tag.color, borderColor: tag.border }}
              >
                {tag.label}
              </span>
              <div
                className="text-[11px] leading-[1.45]"
                style={{ color: "var(--ink-2)" }}
              >
                <strong
                  className="block font-semibold text-[12px] mb-[2px]"
                  style={{ color: "var(--ink-0)" }}
                >
                  {b.title}
                </strong>
                {b.body}
              </div>
            </div>
          );
        })}
      </div>
      )}
    </Panel>
  );
}
