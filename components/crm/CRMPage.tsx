"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Task, Entity, CRMView, Urgency } from "./types";
import KanbanView   from "./KanbanView";
import SmartView    from "./SmartView";
import CategoryView from "./CategoryView";
import TaskDrawer   from "./TaskDrawer";

const VIEW_KEY = "synapse:crm:view";

const VIEWS: { id: CRMView; label: string }[] = [
  { id: "kanban",   label: "Kanban" },
  { id: "smart",    label: "✦ Smart" },
  { id: "category", label: "Category" },
];

export default function CRMPage() {
  const [tasks,        setTasks]        = useState<Task[]>([]);
  const [entities,     setEntities]     = useState<Entity[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [view,         setView]         = useState<CRMView>("kanban");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);  // null = create
  const [drawerOpen,   setDrawerOpen]   = useState(false);
  const [newUrgency,   setNewUrgency]   = useState<Urgency>("this_week");
  const viewRef = useRef<CRMView>("kanban");

  /* ─── Restore view from localStorage ─── */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_KEY) as CRMView | null;
      if (saved && VIEWS.some(v => v.id === saved)) {
        setView(saved);
        viewRef.current = saved;
      }
    } catch { /* ignore */ }
  }, []);

  /* ─── Fetch tasks and entities ─── */
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, eRes] = await Promise.all([
        fetch("/api/tasks?status=open"),
        fetch("/api/entities"),
      ]);
      const [tJson, eJson] = await Promise.all([tRes.json(), eRes.json()]) as [
        { tasks?: Task[] },
        { entities?: Entity[] },
      ];
      setTasks(tJson.tasks ?? []);
      setEntities(eJson.entities ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  /* ─── View change ─── */
  function changeView(v: CRMView) {
    setView(v);
    viewRef.current = v;
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* ignore */ }
  }

  /* ─── Open drawer ─── */
  function openCreate(urgency: Urgency = newUrgency) {
    setNewUrgency(urgency);
    setSelectedTask(null);
    setDrawerOpen(true);
  }

  function openEdit(task: Task) {
    setSelectedTask(task);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setSelectedTask(null);
  }

  /* ─── CRUD handlers ─── */
  async function handleCreate(fields: Partial<Task>) {
    // Compute priority_score = max in tier + 1000
    const tier      = (fields.urgency ?? "this_week") as Urgency;
    const tierTasks = tasks.filter(t => t.urgency === tier);
    const maxScore  = tierTasks.reduce((m, t) => Math.max(m, t.priority_score ?? 0), 0);

    const res  = await fetch("/api/tasks", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ ...fields, priority_score: maxScore + 1000 }),
    });
    const json = await res.json() as { task?: Task };
    if (json.task) setTasks(prev => [json.task!, ...prev]);
  }

  async function handleSave(patch: Partial<Task>) {
    if (!selectedTask) return;
    const res  = await fetch(`/api/tasks/${selectedTask.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(patch),
    });
    const json = await res.json() as { task?: Task };
    if (json.task) {
      setTasks(prev => prev.map(t => t.id === json.task!.id ? json.task! : t));
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    setTasks(prev => prev.filter(t => t.id !== id));
  }

  async function handleComplete(id: string, done: boolean) {
    const completed_at = done ? new Date().toISOString() : null;
    const res  = await fetch(`/api/tasks/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ completed_at }),
    });
    const json = await res.json() as { task?: Task };
    if (json.task) {
      setTasks(prev => prev.map(t => t.id === json.task!.id ? json.task! : t));
    }
  }

  function handleReorder(taskId: string, newUrgency: Urgency, newScore: number) {
    // Optimistic update
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, urgency: newUrgency, priority_score: newScore } : t,
    ));
    // Persist
    fetch(`/api/tasks/${taskId}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ urgency: newUrgency, priority_score: newScore }),
    }).catch(console.error);
  }

  /* ─── Render ─── */
  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Top bar */}
      <div
        className="flex items-center gap-3 mb-4 pb-4"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        {/* View tabs */}
        <div
          className="flex items-center gap-[3px] p-[3px] rounded-[10px]"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
        >
          {VIEWS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => changeView(id)}
              className="px-3 py-[5px] rounded-[7px] text-[12px] font-medium transition-all"
              style={
                view === id
                  ? { background: "var(--surface)", color: "var(--ink-0)", border: "1px solid var(--border-strong)" }
                  : { background: "transparent", color: "var(--ink-2)", border: "1px solid transparent" }
              }
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Task count */}
        {!loading && (
          <span className="text-[12px]" style={{ color: "var(--ink-2)" }}>
            {tasks.filter(t => !t.completed_at).length} open
          </span>
        )}

        {/* New task button */}
        <button
          onClick={() => openCreate()}
          className="flex items-center gap-[6px] px-3 py-[6px] rounded-[8px] text-[12px] font-semibold transition-all"
          style={{
            background: "var(--col-session)",
            color:      "#000",
          }}
        >
          <span className="text-[14px] leading-none">+</span>
          New Task
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-16" style={{ color: "var(--ink-2)" }}>
          <div className="text-[13px]">Loading tasks…</div>
        </div>
      )}

      {/* View content */}
      {!loading && (
        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          {view === "kanban" && (
            <KanbanView
              tasks={tasks}
              entities={entities}
              onTaskClick={openEdit}
              onNewTask={openCreate}
              onReorder={handleReorder}
            />
          )}
          {view === "smart" && (
            <SmartView
              tasks={tasks}
              entities={entities}
              onTaskClick={openEdit}
            />
          )}
          {view === "category" && (
            <CategoryView
              tasks={tasks}
              entities={entities}
              onTaskClick={openEdit}
            />
          )}
        </div>
      )}

      {/* Task drawer */}
      {drawerOpen && (
        <TaskDrawer
          task={selectedTask}
          entities={entities}
          onClose={closeDrawer}
          onSave={handleSave}
          onCreate={handleCreate}
          onDelete={handleDelete}
          onComplete={handleComplete}
        />
      )}
    </div>
  );
}
