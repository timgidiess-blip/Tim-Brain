import Panel, { CardHeader } from "./Panel";

const ACCENT = "var(--col-blockers)";

type Severity = "crit" | "high" | "med";

interface Blocker {
  severity: Severity;
  title: string;
  body: string;
}

const BLOCKERS: Blocker[] = [
  {
    severity: "crit",
    title: "API Rate Limit Hit",
    body: "Production calls throttled since 08:12. Awaiting quota reset.",
  },
  {
    severity: "high",
    title: "Investor Deck Review",
    body: "Pending sign-off from Jordan. Deadline: EOD Tue.",
  },
  {
    severity: "med",
    title: "CRM Data Migration",
    body: "Legacy contacts not synced. Needs manual field mapping.",
  },
];

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
      <CardHeader title="Key Blockers" badge="3 Active" />

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
    </Panel>
  );
}
