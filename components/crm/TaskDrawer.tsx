"use client";

import { useEffect, useRef, useState } from "react";
import type { Task, Entity } from "./types";
import { URGENCY_TIERS, URGENCY_META } from "./types";

interface Props {
  task:        Task | null;      // null = create mode
  entities:    Entity[];
  onClose:     () => void;
  onSave:      (patch: Partial<Task>) => Promise<void>;
  onCreate:    (fields: Partial<Task>) => Promise<void>;
  onDelete:    (id: string) => Promise<void>;
  onComplete:  (id: string, done: boolean) => Promise<void>;
}

const BLANK: Partial<Task> = {
  title:             "",
  description:       null,
  urgency:           "this_week",
  key:               false,
  time_estimate_min: null,
  tags:              null,
  due_date:          null,
  entity_id:         null,
  owner:             null,
};

export default function TaskDrawer({ task, entities, onClose, onSave, onCreate, onDelete, onComplete }: Props) {
  const isCreate = !task;
  const [form, setForm] = useState<Partial<Task>>(task ?? BLANK);
  const [saving,  setSaving]  = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  // Reset form whenever the selected task changes
  useEffect(() => {
    setForm(task ?? BLANK);
    setConfirmDel(false);
  }, [task]);

  // Auto-focus title on open
  useEffect(() => { setTimeout(() => titleRef.current?.focus(), 50); }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const set = (k: keyof Task, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  async function handleSave() {
    if (!form.title?.trim()) return;
    setSaving(true);
    try {
      if (isCreate) await onCreate(form);
      else          await onSave(form);
      onClose();
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!task) return;
    if (!confirmDel) { setConfirmDel(true); return; }
    setDeleting(true);
    try { await onDelete(task.id); onClose(); }
    finally { setDeleting(false); }
  }

  async function handleComplete() {
    if (!task) return;
    await onComplete(task.id, !task.completed_at);
    onClose();
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: "oklch(0% 0 0 / 0.45)", backdropFilter: "blur(2px)" }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed right-0 top-0 h-full z-50 flex flex-col"
        style={{
          width:      "min(480px, 95vw)",
          background: "oklch(13% 0.022 255 / 0.97)",
          borderLeft: "1px solid oklch(28% 0.030 255 / 0.55)",
          backdropFilter: "blur(24px)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: "1px solid oklch(28% 0.030 255 / 0.45)" }}
        >
          <span className="text-[13px] font-semibold tracking-[0.04em]" style={{ color: "var(--ink-1)" }}>
            {isCreate ? "New Task" : "Edit Task"}
          </span>
          <button
            onClick={onClose}
            className="w-[28px] h-[28px] rounded-[6px] flex items-center justify-center text-[16px] transition-colors"
            style={{ color: "var(--ink-2)" }}
          >
            ×
          </button>
        </div>

        {/* Form body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">

          {/* Title */}
          <div>
            <label className="block text-[11px] font-semibold mb-1 tracking-[0.06em]" style={{ color: "var(--ink-2)" }}>
              TITLE *
            </label>
            <input
              ref={titleRef}
              value={form.title ?? ""}
              onChange={e => set("title", e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSave(); }}
              className="w-full rounded-[8px] px-3 py-2 text-[14px] outline-none transition-colors"
              style={{
                background: "oklch(20% 0.022 255 / 0.6)",
                border:     "1px solid oklch(35% 0.025 255 / 0.55)",
                color:      "var(--ink-0)",
              }}
              placeholder="What needs to get done?"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[11px] font-semibold mb-1 tracking-[0.06em]" style={{ color: "var(--ink-2)" }}>
              DESCRIPTION
            </label>
            <textarea
              value={form.description ?? ""}
              onChange={e => set("description", e.target.value || null)}
              rows={3}
              className="w-full rounded-[8px] px-3 py-2 text-[13px] outline-none transition-colors resize-none"
              style={{
                background: "oklch(20% 0.022 255 / 0.6)",
                border:     "1px solid oklch(35% 0.025 255 / 0.55)",
                color:      "var(--ink-1)",
              }}
              placeholder="Optional details…"
            />
          </div>

          {/* Urgency + Key row */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-[11px] font-semibold mb-1 tracking-[0.06em]" style={{ color: "var(--ink-2)" }}>
                URGENCY
              </label>
              <select
                value={form.urgency ?? "this_week"}
                onChange={e => set("urgency", e.target.value)}
                className="w-full rounded-[8px] px-3 py-2 text-[13px] outline-none"
                style={{
                  background: "oklch(20% 0.022 255 / 0.6)",
                  border:     "1px solid oklch(35% 0.025 255 / 0.55)",
                  color:      "var(--ink-0)",
                }}
              >
                {URGENCY_TIERS.map(u => (
                  <option key={u} value={u}>{URGENCY_META[u].label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold mb-1 tracking-[0.06em]" style={{ color: "var(--ink-2)" }}>
                KEY TASK
              </label>
              <button
                onClick={() => set("key", !form.key)}
                className="w-full h-[37px] px-4 rounded-[8px] text-[13px] font-medium transition-all"
                style={
                  form.key
                    ? { background: "oklch(65% 0.18 78 / 0.20)", border: "1px solid oklch(80% 0.18 78 / 0.45)", color: "var(--col-priorities)" }
                    : { background: "oklch(20% 0.022 255 / 0.6)", border: "1px solid oklch(35% 0.025 255 / 0.55)", color: "var(--ink-2)" }
                }
              >
                {form.key ? "🔑 Yes" : "— No"}
              </button>
            </div>
          </div>

          {/* Time estimate + Due date */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-[11px] font-semibold mb-1 tracking-[0.06em]" style={{ color: "var(--ink-2)" }}>
                ESTIMATE (min)
              </label>
              <input
                type="number"
                min={1}
                value={form.time_estimate_min ?? ""}
                onChange={e => set("time_estimate_min", e.target.value ? Number(e.target.value) : null)}
                className="w-full rounded-[8px] px-3 py-2 text-[13px] outline-none"
                style={{
                  background: "oklch(20% 0.022 255 / 0.6)",
                  border:     "1px solid oklch(35% 0.025 255 / 0.55)",
                  color:      "var(--ink-0)",
                }}
                placeholder="e.g. 30"
              />
            </div>

            <div className="flex-1">
              <label className="block text-[11px] font-semibold mb-1 tracking-[0.06em]" style={{ color: "var(--ink-2)" }}>
                DUE DATE
              </label>
              <input
                type="date"
                value={form.due_date ?? ""}
                onChange={e => set("due_date", e.target.value || null)}
                className="w-full rounded-[8px] px-3 py-2 text-[13px] outline-none"
                style={{
                  background: "oklch(20% 0.022 255 / 0.6)",
                  border:     "1px solid oklch(35% 0.025 255 / 0.55)",
                  color:      form.due_date ? "var(--ink-0)" : "var(--ink-2)",
                  colorScheme: "dark",
                }}
              />
            </div>
          </div>

          {/* Entity + Owner */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-[11px] font-semibold mb-1 tracking-[0.06em]" style={{ color: "var(--ink-2)" }}>
                ENTITY / PROJECT
              </label>
              <select
                value={form.entity_id ?? ""}
                onChange={e => set("entity_id", e.target.value || null)}
                className="w-full rounded-[8px] px-3 py-2 text-[13px] outline-none"
                style={{
                  background: "oklch(20% 0.022 255 / 0.6)",
                  border:     "1px solid oklch(35% 0.025 255 / 0.55)",
                  color:      "var(--ink-0)",
                }}
              >
                <option value="">— none —</option>
                {entities.map(e => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>

            <div className="flex-1">
              <label className="block text-[11px] font-semibold mb-1 tracking-[0.06em]" style={{ color: "var(--ink-2)" }}>
                OWNER
              </label>
              <input
                value={form.owner ?? ""}
                onChange={e => set("owner", e.target.value || null)}
                className="w-full rounded-[8px] px-3 py-2 text-[13px] outline-none"
                style={{
                  background: "oklch(20% 0.022 255 / 0.6)",
                  border:     "1px solid oklch(35% 0.025 255 / 0.55)",
                  color:      "var(--ink-0)",
                }}
                placeholder="e.g. @tim"
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-[11px] font-semibold mb-1 tracking-[0.06em]" style={{ color: "var(--ink-2)" }}>
              TAGS <span className="font-normal opacity-60">(comma-separated)</span>
            </label>
            <input
              value={form.tags?.join(", ") ?? ""}
              onChange={e => {
                const val = e.target.value.trim();
                set("tags", val ? val.split(",").map(s => s.trim()).filter(Boolean) : null);
              }}
              className="w-full rounded-[8px] px-3 py-2 text-[13px] outline-none"
              style={{
                background: "oklch(20% 0.022 255 / 0.6)",
                border:     "1px solid oklch(35% 0.025 255 / 0.55)",
                color:      "var(--ink-0)",
              }}
              placeholder="synapse, mvp, q2-2026"
            />
          </div>

          {/* Completed_at display (edit mode only) */}
          {task?.completed_at && (
            <div
              className="text-[12px] px-3 py-2 rounded-[8px]"
              style={{ background: "oklch(30% 0.08 145 / 0.15)", border: "1px solid oklch(50% 0.12 145 / 0.25)", color: "oklch(72% 0.14 145)" }}
            >
              ✅ Completed {new Date(task.completed_at).toLocaleDateString("en-GB", { month: "short", day: "numeric", year: "numeric" })}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div
          className="shrink-0 px-5 py-4 flex items-center gap-2"
          style={{ borderTop: "1px solid oklch(28% 0.030 255 / 0.45)" }}
        >
          {/* Delete (edit only) */}
          {!isCreate && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-3 py-[7px] rounded-[8px] text-[12px] font-medium transition-all"
              style={
                confirmDel
                  ? { background: "oklch(35% 0.16 25 / 0.35)", border: "1px solid oklch(68% 0.22 25 / 0.55)", color: "var(--danger)" }
                  : { background: "transparent", border: "1px solid oklch(35% 0.025 255 / 0.45)", color: "var(--ink-2)" }
              }
            >
              {deleting ? "Deleting…" : confirmDel ? "Confirm delete" : "Delete"}
            </button>
          )}

          {/* Complete / Reopen (edit only) */}
          {!isCreate && (
            <button
              onClick={handleComplete}
              className="px-3 py-[7px] rounded-[8px] text-[12px] font-medium transition-all"
              style={{
                background: "oklch(30% 0.08 145 / 0.15)",
                border:     "1px solid oklch(50% 0.12 145 / 0.25)",
                color:      "oklch(72% 0.14 145)",
              }}
            >
              {task?.completed_at ? "↩ Reopen" : "✓ Complete"}
            </button>
          )}

          <div className="flex-1" />

          <button
            onClick={onClose}
            className="px-3 py-[7px] rounded-[8px] text-[12px] font-medium transition-all"
            style={{ background: "transparent", border: "1px solid oklch(35% 0.025 255 / 0.45)", color: "var(--ink-2)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.title?.trim()}
            className="px-4 py-[7px] rounded-[8px] text-[12px] font-semibold transition-all"
            style={{
              background: "var(--col-session)",
              color:      "#000",
              opacity:    (!form.title?.trim() || saving) ? 0.45 : 1,
            }}
          >
            {saving ? "Saving…" : isCreate ? "Create" : "Save"}
          </button>
        </div>
      </div>
    </>
  );
}
