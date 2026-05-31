"use client";

import type { Task, Entity } from "./types";
import { URGENCY_META } from "./types";
import TaskCard from "./TaskCard";

interface Props {
  tasks:       Task[];
  entities:    Entity[];
  onTaskClick: (task: Task) => void;
}

export default function CategoryView({ tasks, entities, onTaskClick }: Props) {
  const openTasks = tasks.filter(t => !t.completed_at);

  // Group by entity_id
  const groups = new Map<string | null, Task[]>();
  for (const task of openTasks) {
    const key = task.entity_id ?? null;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(task);
  }

  // Sort groups: entities by name, null last
  const sortedKeys = [...groups.keys()].sort((a, b) => {
    if (a === null) return 1;
    if (b === null) return -1;
    const na = entities.find(e => e.id === a)?.name ?? "";
    const nb = entities.find(e => e.id === b)?.name ?? "";
    return na.localeCompare(nb);
  });

  if (openTasks.length === 0) {
    return (
      <div className="text-center py-16" style={{ color: "var(--ink-2)" }}>
        <div className="text-[32px] mb-2">✅</div>
        <div className="text-[13px]">No open tasks</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {sortedKeys.map(entityId => {
        const entity    = entities.find(e => e.id === entityId);
        const groupName = entity?.name ?? "Uncategorized";
        const groupKind = entity?.kind;
        const groupTasks = (groups.get(entityId) ?? []).sort(
          (a, b) => (b.priority_score ?? 0) - (a.priority_score ?? 0),
        );

        // Urgency breakdown counts
        const counts = groupTasks.reduce<Record<string, number>>((acc, t) => {
          acc[t.urgency] = (acc[t.urgency] ?? 0) + 1;
          return acc;
        }, {});

        return (
          <div key={entityId ?? "__none__"}>
            {/* Group header */}
            <div
              className="flex items-center gap-3 mb-2 pb-2"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <div>
                <span className="text-[14px] font-semibold" style={{ color: "var(--ink-0)" }}>
                  {groupName}
                </span>
                {groupKind && (
                  <span className="ml-2 text-[11px]" style={{ color: "var(--ink-2)" }}>
                    {groupKind}
                  </span>
                )}
              </div>

              {/* Urgency breakdown chips */}
              <div className="flex items-center gap-1 ml-auto">
                {(["today","this_week","this_month","someday"] as const).map(u => {
                  const count = counts[u];
                  if (!count) return null;
                  const meta = URGENCY_META[u];
                  return (
                    <span
                      key={u}
                      className="text-[10px] px-[6px] py-[2px] rounded-[4px] font-semibold"
                      style={{ color: meta.color, background: meta.bg, border: `1px solid ${meta.border}` }}
                    >
                      {meta.label.split(" ")[0]} ×{count}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Task cards */}
            <div className="flex flex-col gap-2">
              {groupTasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onClick={() => onTaskClick(task)}
                  showUrgency
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
