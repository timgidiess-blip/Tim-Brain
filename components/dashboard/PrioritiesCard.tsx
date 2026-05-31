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

const PRIORITIES: Priority[] = [];

export default function PrioritiesCard() {
  return (
    <Panel accent={ACCENT}>
      <CardHeader title="Priorities" badge={PRIORITIES.length > 0 ? `${PRIORITIES.length} Active` : "Empty"} />

      {PRIORITIES.length === 0 ? (
        <div
          className="rounded-[10px] px-4 py-5 text-center"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
        >
          <div className="text-[22px] mb-2 select-none">🎯</div>
          <div className="text-[12px] font-medium mb-1" style={{ color: "var(--ink-1)" }}>
            No priorities yet
          </div>
          <div className="text-[10px]" style={{ color: "var(--ink-2)" }}>
            Your top priorities will show here.
          </div>
        </div>
      ) : (
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
      )}
    </Panel>
  );
}
