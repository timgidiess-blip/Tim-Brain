"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SectionId, SectionLayout, WidgetLayoutItem } from "./types";
import { widgetsForSection } from "./registry";

// Default layout for a section, derived from the registry.
function defaultLayout(section: SectionId): SectionLayout {
  return widgetsForSection(section).map((w, i) => ({
    widgetId: w.id,
    visible:  w.defaultVisible,
    order:    i,
    colSpan:  w.defaultColSpan,
  }));
}

// Merge saved overrides with the registry so newly-added widgets appear and
// removed widgets drop out. Saved order/visibility/colSpan win; unknown saved
// ids are discarded; missing registry widgets are appended.
function mergeLayout(section: SectionId, saved: SectionLayout): SectionLayout {
  const known = new Set(widgetsForSection(section).map((w) => w.id));
  const savedById = new Map(saved.filter((i) => known.has(i.widgetId)).map((i) => [i.widgetId, i]));

  const merged = defaultLayout(section).map((def) => {
    const override = savedById.get(def.widgetId);
    return override ? { ...def, ...override } : def;
  });

  // Re-pack order to be contiguous in the saved sequence.
  return merged
    .sort((a, b) => a.order - b.order)
    .map((item, i) => ({ ...item, order: i }));
}

export interface UseLayout {
  items:   SectionLayout;            // all widgets, sorted by order (visible flag varies)
  loading: boolean;
  editing: boolean;
  setEditing: (v: boolean) => void;
  reorder: (fromId: string, toId: string) => void;
  toggle:  (widgetId: string) => void;
  setSpan: (widgetId: string, colSpan: 1 | 2) => void;
}

export function useLayout(section: SectionId): UseLayout {
  const [items, setItems] = useState<SectionLayout>(() => defaultLayout(section));
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);

  // Load saved layout on mount / section change.
  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/layout?section=${section}`)
      .then((r) => (r.ok ? r.json() : { layout: [] }))
      .then((json: { layout?: SectionLayout }) => {
        if (!active) return;
        setItems(mergeLayout(section, json.layout ?? []));
      })
      .catch(() => { if (active) setItems(defaultLayout(section)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [section]);

  // Debounced persistence whenever the layout changes after a user edit.
  const schedulePersist = useCallback((next: SectionLayout) => {
    dirty.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void fetch("/api/layout", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ section, layout: next }),
      }).catch(() => { /* best-effort; retried on next change */ });
    }, 500);
  }, [section]);

  const apply = useCallback((updater: (prev: SectionLayout) => SectionLayout) => {
    setItems((prev) => {
      const next = updater(prev).map((item, i) => ({ ...item, order: i }));
      schedulePersist(next);
      return next;
    });
  }, [schedulePersist]);

  const reorder = useCallback((fromId: string, toId: string) => {
    apply((prev) => {
      const from = prev.findIndex((i) => i.widgetId === fromId);
      const to   = prev.findIndex((i) => i.widgetId === toId);
      if (from < 0 || to < 0 || from === to) return prev;
      const next = prev.slice();
      const [moved] = next.splice(from, 1);
      if (moved) next.splice(to, 0, moved);
      return next;
    });
  }, [apply]);

  const toggle = useCallback((widgetId: string) => {
    apply((prev) => prev.map((i) => (i.widgetId === widgetId ? { ...i, visible: !i.visible } : i)));
  }, [apply]);

  const setSpan = useCallback((widgetId: string, colSpan: 1 | 2) => {
    apply((prev) => prev.map((i) => (i.widgetId === widgetId ? { ...i, colSpan } : i)));
  }, [apply]);

  // Flush a pending save on unmount.
  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  return useMemo<UseLayout>(
    () => ({ items, loading, editing, setEditing, reorder, toggle, setSpan }),
    [items, loading, editing, reorder, toggle, setSpan],
  );
}

// Re-exported for callers that only need the registry helper alongside the hook.
export type { WidgetLayoutItem };
