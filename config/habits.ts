// ── Habit config ──────────────────────────────────────────────────────────────
// Edit this list to change which habits appear in the tracker.
// `id` must be stable (it's the key stored in the DB).

export interface HabitDef {
  id:    string;
  label: string;
  emoji: string;
}

export const HABITS: HabitDef[] = [
  { id: "morning_run",  label: "Morning Run",  emoji: "🏃" },
  { id: "deep_work",    label: "Deep Work",    emoji: "🧠" },
  { id: "meditation",   label: "Meditation",   emoji: "🧘" },
  { id: "no_alcohol",   label: "No Alcohol",   emoji: "🚫" },
  { id: "cold_shower",  label: "Cold Shower",  emoji: "🚿" },
  { id: "read_30min",   label: "Read 30 min",  emoji: "📖" },
] as const;
