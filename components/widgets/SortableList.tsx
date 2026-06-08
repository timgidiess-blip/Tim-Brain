"use client";

import type { ReactNode } from "react";
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
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Handle props are spread onto whatever element should initiate a drag, so a
// row can scope dragging to a grip icon while keeping the rest interactive.
type SortableReturn = ReturnType<typeof useSortable>;
export interface DragHandleProps {
  ref:        SortableReturn["setActivatorNodeRef"];
  attributes: SortableReturn["attributes"];
  listeners:  SortableReturn["listeners"];
}

interface SortableListProps<T> {
  items:      T[];
  getId:      (item: T) => string;
  renderItem: (item: T, handle: DragHandleProps, isDragging: boolean) => ReactNode;
  onReorder:  (orderedIds: string[]) => void;
  disabled?:  boolean;
}

function Row<T>({
  item,
  id,
  renderItem,
}: {
  item: T;
  id: string;
  renderItem: SortableListProps<T>["renderItem"];
}) {
  const { setNodeRef, transform, transition, isDragging, attributes, listeners, setActivatorNodeRef } =
    useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.7 : 1,
        zIndex:  isDragging ? 10 : undefined,
        position: "relative",
      }}
    >
      {renderItem(item, { ref: setActivatorNodeRef, attributes, listeners }, isDragging)}
    </div>
  );
}

export default function SortableList<T>({
  items,
  getId,
  renderItem,
  onReorder,
  disabled = false,
}: SortableListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ids = items.map(getId);

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to   = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    const next = ids.slice();
    const [moved] = next.splice(from, 1);
    if (moved) next.splice(to, 0, moved);
    onReorder(next);
  }

  if (disabled) {
    const noHandle: DragHandleProps = {
      ref: () => {},
      attributes: {} as SortableReturn["attributes"],
      listeners: undefined,
    };
    return (
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <div key={getId(item)}>{renderItem(item, noHandle, false)}</div>
        ))}
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <Row key={getId(item)} id={getId(item)} item={item} renderItem={renderItem} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
