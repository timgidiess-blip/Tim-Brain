export type Urgency = "today" | "this_week" | "this_month" | "someday";
export const URGENCY_TIERS: Urgency[] = ["today", "this_week", "this_month", "someday"];

export interface Task {
  id:                string;
  title:             string;
  description:       string | null;
  urgency:           Urgency;
  key:               boolean;
  priority_score:    number | null;
  time_estimate_min: number | null;
  tags:              string[] | null;
  due_date:          string | null;
  entity_id:         string | null;
  owner:             string | null;
  completed_at:      string | null;
  created_at:        string;
  updated_at:        string;
}

export interface Entity {
  id:   string;
  name: string;
  kind: string;
}

export type CRMView = "kanban" | "smart" | "category";

export const URGENCY_META: Record<Urgency, { label: string; color: string; bg: string; border: string }> = {
  today:      { label: "Today",      color: "var(--danger)",       bg: "oklch(68% 0.22 25 / 0.10)",   border: "oklch(68% 0.22 25 / 0.30)"  },
  this_week:  { label: "This Week",  color: "var(--warn)",         bg: "oklch(80% 0.18 78 / 0.10)",   border: "oklch(80% 0.18 78 / 0.30)"  },
  this_month: { label: "This Month", color: "var(--col-habits)",   bg: "oklch(70% 0.19 225 / 0.10)",  border: "oklch(70% 0.19 225 / 0.30)" },
  someday:    { label: "Someday",    color: "var(--ink-2)",        bg: "oklch(28% 0.018 255 / 0.35)", border: "oklch(35% 0.018 255 / 0.40)" },
};
