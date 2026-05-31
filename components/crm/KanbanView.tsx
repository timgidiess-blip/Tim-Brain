"use client";

import { useCallback, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";
import type { Task, Entity, Urgency } from "./types";
import { URGENCY_TIERS, URGENCY_META } from "./types";
import TaskCard from "./TaskCard";

interface Props {
  tasks:        Task[];
  entities:     Entity[];
  onTaskClick:  (task: Task) => void;
  onNewTask:    (urgency: Urgency) => void;
  onReorder:    (taskId: string, newUrgency: Urgency, newScore: number) => void;
}

/* ─── Droppable column ─── */
function KanbanColumn({
  urgency, tasks, entities, onTaskClick, onNewTask, activeId,
}: {
  urgency:     Urgency;
  tasks:       Task[];
  entities:    Entity[];
  onTaskClick: (task: Task) => void;
  onNewTask:   (u: Urgency) => void;
  activeId:    string | null;
}) {
  const meta = URGENCY_META[urgency];
  const { setNodeRef } = useDroppable({ id: urgency });
  const open = tasks.filter(t => !t.completed_at);
  const done = tasks.filter(t =>  t.completed_at);

  return (
    <div
      ref={setNodeRef}
      className="flex flex-col gap-2 min-h-[120px] flex-1"
      style={{ minWidth: 0 }}
    >
      {/* Column header */}
      <div
        className="flex items-center justify-between px-2 py-[6px] rounded-[8px] mb-1"
        style={{ background: meta.bg, border: `1px solid ${meta.border}` }}
      >
        <span className="text-[11px] font-bold tracking-[0.08em]" style={{ color: meta.color }}>
          {meta.label.toUpperCase()}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[10px]" style={{ color: meta.color, opacity: 0.7 }}>{open.length}</span>
          <button
            onClick={() => onNewTask(urgency)}
            className="text-[14px] leading-none rounded-[4px] px-[4px] py-[1px] transition-colors"
            style={{ color: meta.color, opacity: 0.7 }}
            title={`Add task to ${meta.label}`}
          >
            +
          </button>
        </div>
      </div>

      {/* Open tasks */}
      <SortableContext items={open.map(t => t.id)} strategy={verticalListSortingStrategy}>
        {open.map(t => (
          <SortableTaskCard
            key={t.id}
            task={t}
            entity={entities.find(e => e.id === t.entity_id)}
            onClick={() => onTaskClick(t)}
            isDraggingThis={activeId === t.id}
          />
        ))}
      </SortableContext>

      {open.length === 0 && (
        <div
          className="flex items-center justify-center py-6 rounded-[8px] text-[12px]"
          style={{ border: "1px dashed oklch(35% 0.020 255 / 0.4)", color: "var(--ink-2)" }}
        >
          Drop here
        </div>
      )}

      {/* Completed tasks (collapsed) */}
      {done.length > 0 && (
        <div className="mt-1">
          <span className="text-[10px]" style={{ color: "var(--ink-2)" }}>
            {done.length} completed
          </span>
        </div>
      )}
    </div>
  );
}

/* ─── Sortable task card ─── */
function SortableTaskCard({
  task, entity, onClick, isDraggingThis,
}: {
  task:           Task;
  entity?:        Entity;
  onClick:        () => void;
  isDraggingThis: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id:   task.id,
    data: { urgency: task.urgency },
  });

  const style: React.CSSProperties = {
    transform:  CSS.Transform.toString(transform),
    transition,
    opacity:    isDragging ? 0 : 1,
    touchAction: "none",
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard task={task} entity={entity} onClick={onClick} />
    </div>
  );
}

/* ─── Main KanbanView ─── */
export default function KanbanView({ tasks, entities, onTaskClick, onNewTask, onReorder }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const activeTask = tasks.find(t => t.id === activeId) ?? null;

  const tasksByUrgency = useCallback((u: Urgency) =>
    tasks
      .filter(t => (t.urgency as string) === u)
      .sort((a, b) => (b.priority_score ?? 0) - (a.priority_score ?? 0)),
  [tasks]);

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(String(active.id));
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const activeId   = String(active.id);
    const overId     = String(over.id);
    const activeTask = tasks.find(t => t.id === activeId);
    if (!activeTask) return;

    // Determine target urgency column
    const isColumnDrop = (URGENCY_TIERS as string[]).includes(overId);
    const overTask     = tasks.find(t => t.id === overId);
    const targetUrgency: Urgency = isColumnDrop
      ? (overId as Urgency)
      : ((overTask?.urgency ?? activeTask.urgency) as Urgency);

    // Get sorted tasks in target column, excluding active task
    const colTasks = tasks
      .filter(t => t.urgency === targetUrgency && t.id !== activeId && !t.completed_at)
      .sort((a, b) => (b.priority_score ?? 0) - (a.priority_score ?? 0));

    let newScore: number;

    if (isColumnDrop || !overTask) {
      // Drop on column or empty space → bottom of column
      const min = colTasks.at(-1)?.priority_score ?? 0;
      newScore = min - 1000;
    } else {
      const overIdx = colTasks.findIndex(t => t.id === overId);
      const above   = colTasks[overIdx - 1];
      const below   = colTasks[overIdx];

      if (!above) {
        // Top of column
        newScore = (below?.priority_score ?? 0) + 1000;
      } else if (!below) {
        newScore = (above.priority_score ?? 0) - 1000;
      } else {
        newScore = ((above.priority_score ?? 0) + (below.priority_score ?? 0)) / 2;
      }
    }

    onReorder(activeId, targetUrgency, newScore);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function handleDragOver(_event: DragOverEvent) {
    // Visual feedback only — actual state update is in onDragEnd
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 h-full" style={{ alignItems: "flex-start" }}>
        {URGENCY_TIERS.map(urgency => (
          <KanbanColumn
            key={urgency}
            urgency={urgency}
            tasks={tasksByUrgency(urgency)}
            entities={entities}
            onTaskClick={onTaskClick}
            onNewTask={onNewTask}
            activeId={activeId}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeTask ? (
          <TaskCard
            task={activeTask}
            entity={entities.find(e => e.id === activeTask.entity_id)}
            onClick={() => {}}
            dragging
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
