import Panel, { CardHeader } from "./Panel";

const ACCENT = "var(--col-priorities)";

interface Priority {
  num: string;
  title: string;
  tag: string;
  due: string;
  barPct: number;
  accentColor: string;
  tagBg: string;
  tagColor: string;
}

const PRIORITIES: Priority[] = [
  {
    num: "01", title: "Launch V2 Beta to 50 users",
    tag: "Product", due: "Due: 28 May", barPct: 74,
    accentColor: "var(--col-blockers)",
    tagBg: "oklch(72% 0.22 290 / 0.14)", tagColor: "oklch(72% 0.22 290)",
  },
  {
    num: "02", title: "Close Series A term sheet",
    tag: "Ops", due: "Due: 05 Jun", barPct: 41,
    accentColor: "oklch(75% 0.18 60)",
    tagBg: "oklch(75% 0.18 60 / 0.14)", tagColor: "oklch(75% 0.18 60)",
  },
  {
    num: "03", title: "Finalise AI memory architecture doc",
    tag: "Research", due: "Due: 26 May", barPct: 88,
    accentColor: "var(--col-habits)",
    tagBg: "oklch(70% 0.19 225 / 0.14)", tagColor: "oklch(70% 0.19 225)",
  },
  {
    num: "04", title: "Newsletter — May edition draft",
    tag: "Comms", due: "Due: 31 May", barPct: 18,
    accentColor: "var(--ink-2)",
    tagBg: "oklch(72% 0.19 145 / 0.14)", tagColor: "oklch(72% 0.19 145)",
  },
];

export default function PrioritiesCard() {
  return (
    <Panel accent={ACCENT}>
      <CardHeader title="Priorities" badge="4 Active" />

      <div className="flex flex-col gap-2">
        {PRIORITIES.map((p) => (
          <div
            key={p.num}
            className="flex items-start gap-[10px] px-3 py-[10px] rounded-[10px] relative overflow-hidden"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
            }}
          >
            {/* Left colour bar */}
            <div
              className="absolute left-0 top-0 bottom-0 w-[3px]"
              style={{ background: p.accentColor }}
            />

            <span
              className="text-[10px] font-bold font-mono mt-[2px] shrink-0"
              style={{ color: "var(--ink-2)" }}
            >
              {p.num}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-medium mb-[5px]">{p.title}</div>
              <div className="flex items-center gap-[7px]">
                <span
                  className="text-[8px] font-bold px-[5px] py-[1px] rounded-[4px] tracking-[0.05em] uppercase"
                  style={{ background: p.tagBg, color: p.tagColor }}
                >
                  {p.tag}
                </span>
                <span
                  className="text-[9px] font-mono"
                  style={{ color: "var(--ink-2)" }}
                >
                  {p.due}
                </span>
              </div>
              <div
                className="h-[3px] rounded-[2px] mt-[7px]"
                style={{ background: "var(--surface-2)" }}
              >
                <div
                  className="h-full rounded-[2px]"
                  style={{ width: `${p.barPct}%`, background: p.accentColor }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
