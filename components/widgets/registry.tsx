import type { SectionId, WidgetDef } from "./types";
import { SECTIONS } from "./types";
import { makePlaceholder } from "./PlaceholderWidget";

// ── Widget registry ─────────────────────────────────────────────────────────────
// Widgets are declared here once. WidgetGrid renders the visible ones in the
// user's saved order; useLayout merges this registry with persisted overrides so
// newly-registered widgets appear automatically. Each phase swaps its section's
// placeholders for real components — the ids stay stable so layouts survive.

function def(
  section: SectionId,
  id: string,
  title: string,
  blurb: string,
  defaultColSpan: 1 | 2 = 1,
  defaultVisible = true,
): WidgetDef {
  return { id, section, title, defaultColSpan, defaultVisible, component: makePlaceholder(blurb) };
}

const REGISTRY: WidgetDef[] = [
  // Tasks (Phase 1)
  def("tasks", "today-tasks", "Today", "Priority-ordered tasks — must-do at the top.", 2),
  def("tasks", "projects",    "Projects", "Group tasks into projects."),
  def("tasks", "reminders",   "Reminders", "Time-sensitive nudges."),

  // Nutrition (Phase 2)
  def("nutrition", "macros",  "Macros", "Calories & macros vs today's target.", 2),
  def("nutrition", "meals",   "Meals", "Breakfast · lunch · dinner · snacks."),
  def("nutrition", "water",   "Water", "Daily water — one-tap top-ups."),

  // Habits (Phase 3)
  def("habits", "checklist",  "Today's habits", "One-tap done / not-done.", 2),
  def("habits", "streaks",    "Streaks", "Per-habit streaks."),

  // Health / Gym (Phase 4)
  def("health", "gym",        "Gym", "Recent workouts — exercises, sets, reps."),
  def("health", "cardio",     "Cardio", "Runs & soccer (calories tracked separately)."),
  def("health", "weight",     "Weight", "Body-weight trend."),
  def("health", "photos",     "Progress photos", "Biweekly progress photos."),

  // Finance (Phase 5)
  def("finance", "net-worth", "Net worth", "Your money at a glance — the tracking bar.", 2),
  def("finance", "cashflow",  "Cashflow", "Income vs expenses."),
  def("finance", "bills",     "Upcoming bills", "Bills & payments due soon."),
  def("finance", "invoices",  "Invoices", "Outstanding invoices."),

  // Brain / Notes (Phase 6)
  def("brain", "inbox",       "Idea inbox", "Captured ideas — kept out of your tasks.", 2),
  def("brain", "planning",    "Planning", "Ideas you're actively shaping."),

  // Goals (Phase 7)
  def("goals", "board",       "Goals", "One steering goal per area, with AI plans.", 2),
];

export const WIDGETS: Record<SectionId, WidgetDef[]> = SECTIONS.reduce(
  (acc, s) => {
    acc[s] = REGISTRY.filter((w) => w.section === s);
    return acc;
  },
  {} as Record<SectionId, WidgetDef[]>,
);

export function widgetsForSection(section: SectionId): WidgetDef[] {
  return WIDGETS[section] ?? [];
}

export function findWidget(section: SectionId, id: string): WidgetDef | undefined {
  return widgetsForSection(section).find((w) => w.id === id);
}
