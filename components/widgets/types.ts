import type { ComponentType } from "react";

// The seven tabs, plus the always-visible roll-up strip.
export const SECTIONS = [
  "tasks",
  "nutrition",
  "habits",
  "health",
  "finance",
  "brain",
  "goals",
] as const;

export type SectionId = (typeof SECTIONS)[number];

export interface SectionMeta {
  id:    SectionId;
  label: string;
  short: string;   // compact label for the mobile tab bar
  icon:  string;   // emoji glyph (lightweight, theme-agnostic)
  accent: string;  // CSS var, e.g. "var(--col-priorities)"
}

// Section presentation — order here is the default tab order.
export const SECTION_META: Record<SectionId, SectionMeta> = {
  tasks:     { id: "tasks",     label: "Tasks",     short: "Tasks",  icon: "✅", accent: "var(--col-priorities)" },
  nutrition: { id: "nutrition", label: "Nutrition", short: "Food",   icon: "🍎", accent: "var(--col-nutrition)" },
  habits:    { id: "habits",    label: "Habits",    short: "Habits", icon: "🔄", accent: "var(--col-habits)" },
  health:    { id: "health",    label: "Health",    short: "Gym",    icon: "🏋️", accent: "var(--col-operator)" },
  finance:   { id: "finance",   label: "Finance",   short: "Money",  icon: "💰", accent: "var(--col-finance)" },
  brain:     { id: "brain",     label: "Brain",     short: "Ideas",  icon: "🧠", accent: "var(--col-session)" },
  goals:     { id: "goals",     label: "Goals",     short: "Goals",  icon: "🎯", accent: "var(--col-calendar)" },
};

export const SECTION_LIST: SectionMeta[] = SECTIONS.map((s) => SECTION_META[s]);

// A widget is declared once in the registry; the grid handles layout + dnd.
export interface WidgetDef {
  id:            string;          // stable id, unique within a section
  section:       SectionId;
  title:         string;
  accent?:       string;          // defaults to the section accent
  defaultColSpan: 1 | 2;          // 2-col grid on desktop; always 1 on mobile
  defaultVisible: boolean;
  component:     ComponentType;   // the widget body (renders inside WidgetFrame)
}

// Persisted per (user, section) in dashboard_layouts.layout.
export interface WidgetLayoutItem {
  widgetId: string;
  visible:  boolean;
  order:    number;
  colSpan:  1 | 2;
}

export type SectionLayout = WidgetLayoutItem[];
