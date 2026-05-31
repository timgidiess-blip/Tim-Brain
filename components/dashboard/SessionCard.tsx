import Link from "next/link";
import Panel, { CardHeader } from "./Panel";
import { getDb } from "@/lib/supabase";

const ACCENT = "var(--col-session)";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Task {
  id:                string;
  title:             string;
  urgency:           string | null;
  key:               boolean;
  priority_score:    number | null;
  time_estimate_min: number | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(min: number | null): string {
  if (!min || min <= 0) return "";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const URGENCY_CHIP: Record<string, { label: string; color: string; bg: string }> = {
  today:      { label: "Today",     color: "var(--danger)", bg: "oklch(68% 0.22 25 / 0.12)"  },
  this_week:  { label: "This Week", color: "var(--warn)",   bg: "oklch(80% 0.18 78 / 0.12)"  },
  this_month: { label: "Month",     color: "var(--col-habits)", bg: "oklch(70% 0.19 225 / 0.12)" },
  someday:    { label: "Someday",   color: "var(--ink-2)",  bg: "var(--surface-2)" },
};

// ── Data fetching ─────────────────────────────────────────────────────────────

async function getTopTasks(): Promise<Task[]> {
  const userId = process.env.TELEGRAM_USER_ID;
  if (!userId) return [];

  try {
    const db = getDb();
    const { data, error } = await db
      .from("tasks")
      .select("id, title, urgency, key, priority_score, time_estimate_min")
      .eq("user_id", userId)
      .is("completed_at", null)
      .or("urgency.eq.today,key.eq.true")
      .order("priority_score", { ascending: false, nullsFirst: false })
      .order("created_at",     { ascending: false })
      .limit(3);

    if (error) {
      console.error("[SessionCard] Supabase error:", error.message);
      return [];
    }

    return (data ?? []) as Task[];
  } catch (e) {
    console.error("[SessionCard] fetch failed:", e);
    return [];
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default async function SessionCard() {
  const tasks = await getTopTasks();

  return (
    <Panel accent={ACCENT}>
      <CardHeader title="Session" badge={tasks.length > 0 ? `${tasks.length} active` : "TODAY"} />

      {/* Section label */}
      <div
        className="text-[10px] font-bold tracking-[0.10em] uppercase mb-3"
        style={{ color: "var(--ink-2)" }}
      >
        Today &amp; Key — Top {tasks.length > 0 ? tasks.length : 0}
      </div>

      {/* Task list */}
      {tasks.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col gap-[8px]">
          {tasks.map((task, i) => (
            <TaskRow key={task.id} task={task} rank={i + 1} />
          ))}
        </div>
      )}
    </Panel>
  );
}

// ── TaskRow ───────────────────────────────────────────────────────────────────

function TaskRow({ task, rank }: { task: Task; rank: number }) {
  const chip    = URGENCY_CHIP[task.urgency ?? "someday"] ?? URGENCY_CHIP["someday"]!;
  const timeStr = fmtTime(task.time_estimate_min);

  return (
    <Link
      href={`/tasks/${task.id}`}
      className="group flex items-start gap-3 rounded-[9px] px-3 py-[10px] transition-colors"
      style={{
        background: "var(--surface-2)",
        border:     "1px solid var(--border)",
      }}
      // hover via CSS var injection — Tailwind group-hover for bg
    >
      {/* Rank number */}
      <span
        className="text-[11px] font-bold font-mono shrink-0 mt-[1px] w-4 text-right leading-tight"
        style={{ color: "var(--col-session)" }}
      >
        {rank}
      </span>

      {/* Title + chips */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-1.5 flex-wrap">
          {task.key && (
            <span className="text-[10px] select-none" title="Key task">🔑</span>
          )}
          <span
            className="text-[12px] leading-snug font-medium group-hover:opacity-80 transition-opacity"
            style={{ color: "var(--ink-0)" }}
          >
            {task.title}
          </span>
        </div>

        <div className="flex items-center gap-2 mt-[5px] flex-wrap">
          {/* Urgency chip */}
          <span
            className="text-[9px] font-semibold px-[6px] py-[2px] rounded-[4px]"
            style={{ color: chip.color, background: chip.bg }}
          >
            {chip.label}
          </span>

          {/* Time estimate */}
          {timeStr && (
            <span
              className="text-[9px] font-mono px-[6px] py-[2px] rounded-[4px]"
              style={{
                color:      "var(--ink-2)",
                background: "var(--surface-2)",
              }}
            >
              ⏱ {timeStr}
            </span>
          )}
        </div>
      </div>

      {/* Arrow */}
      <span
        className="text-[14px] shrink-0 mt-[1px] opacity-30 group-hover:opacity-80 transition-opacity"
        style={{ color: ACCENT }}
      >
        →
      </span>
    </Link>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div
      className="rounded-[9px] px-4 py-5 text-center"
      style={{
        background: "var(--surface-2)",
        border:     "1px solid var(--border)",
      }}
    >
      <div className="text-[22px] mb-2 select-none">✅</div>
      <div className="text-[12px] font-medium mb-1" style={{ color: "var(--ink-1)" }}>
        Clear for today
      </div>
      <div className="text-[10px]" style={{ color: "var(--ink-2)" }}>
        No tasks flagged today or marked key.<br />
        Capture one below or via Telegram.
      </div>
    </div>
  );
}
