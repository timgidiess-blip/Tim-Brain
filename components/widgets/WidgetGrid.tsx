"use client";

import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import type { SectionId } from "./types";
import { SECTION_META } from "./types";
import { findWidget } from "./registry";
import { useLayout } from "./useLayout";
import WidgetFrame from "./WidgetFrame";
import WidgetPicker from "./WidgetPicker";

export default function WidgetGrid({ section }: { section: SectionId }) {
  const layout = useLayout(section);
  const meta = SECTION_META[section];

  const sensors = useSensors(
    // A small distance avoids hijacking taps/clicks on the widget body.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      layout.reorder(String(active.id), String(over.id));
    }
  }

  const visible = layout.items.filter((i) => i.visible);
  const visibleIds = visible.map((i) => i.widgetId);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[15px] font-bold tracking-[0.01em]" style={{ color: "var(--ink-0)" }}>
          <span className="mr-2">{meta.icon}</span>
          {meta.label}
        </h2>
        <WidgetPicker layout={layout} section={section} />
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={visibleIds} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 items-start gap-[14px] md:grid-cols-2">
            {visible.map((item) => {
              const def = findWidget(section, item.widgetId);
              if (!def) return null;
              return (
                <WidgetFrame
                  key={def.id}
                  def={def}
                  item={item}
                  meta={meta}
                  editing={layout.editing}
                  onHide={layout.toggle}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {visible.length === 0 && (
        <div
          className="rounded-[14px] border border-dashed px-5 py-10 text-center text-[13px]"
          style={{ borderColor: "var(--border)", color: "var(--ink-2)" }}
        >
          No widgets here yet — tap <span className="font-semibold">Customize</span> to add some.
        </div>
      )}
    </div>
  );
}
