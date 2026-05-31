"use client";

import { useState } from "react";
import type { Task, Entity } from "./types";
import TaskCard from "./TaskCard";

interface Props {
  tasks:       Task[];
  entities:    Entity[];
  onTaskClick: (task: Task) => void;
}

export default function SmartView({ tasks, entities, onTaskClick }: Props) {
  const [query,     setQuery]     = useState("");
  const [loading,   setLoading]   = useState(false);
  const [resultIds, setResultIds] = useState<string[] | null>(null);
  const [reasoning, setReasoning] = useState<string>("");
  const [error,     setError]     = useState<string | null>(null);

  const openTasks = tasks.filter(t => !t.completed_at);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResultIds(null);
    setReasoning("");

    try {
      const res  = await fetch("/api/tasks/smart", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ query: query.trim() }),
      });
      const json = await res.json() as { ids?: string[]; reasoning?: string; error?: string };
      if (!res.ok || json.error) { setError(json.error ?? "Unknown error"); return; }
      setResultIds(json.ids ?? []);
      setReasoning(json.reasoning ?? "");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setQuery("");
    setResultIds(null);
    setReasoning("");
    setError(null);
  }

  // Ordered results: matched first (in rank order), then rest dimmed
  const rankedTasks = resultIds
    ? [
        ...resultIds.flatMap(id => {
          const t = openTasks.find(t => t.id === id);
          return t ? [{ task: t, matched: true }] : [];
        }),
        ...openTasks
          .filter(t => !resultIds.includes(t.id))
          .map(t => ({ task: t, matched: false })),
      ]
    : openTasks.map(t => ({ task: t, matched: true }));

  return (
    <div className="flex flex-col gap-4">
      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[14px]"
            style={{ color: "var(--ink-2)" }}
          >
            ✦
          </span>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full rounded-[10px] pl-9 pr-4 py-[10px] text-[13px] outline-none"
            style={{
              background: "oklch(20% 0.022 255 / 0.6)",
              border:     "1px solid oklch(35% 0.025 255 / 0.55)",
              color:      "var(--ink-0)",
            }}
            placeholder='Ask Claude anything — "what should I do this morning?"'
          />
        </div>

        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="px-4 py-[10px] rounded-[10px] text-[13px] font-semibold transition-all"
          style={{
            background: "var(--col-session)",
            color:      "#000",
            opacity:    (loading || !query.trim()) ? 0.45 : 1,
            minWidth:   "80px",
          }}
        >
          {loading ? "…" : "Ask AI"}
        </button>

        {resultIds !== null && (
          <button
            type="button"
            onClick={handleClear}
            className="px-3 py-[10px] rounded-[10px] text-[13px] transition-all"
            style={{
              background: "oklch(20% 0.022 255 / 0.6)",
              border:     "1px solid oklch(35% 0.025 255 / 0.55)",
              color:      "var(--ink-2)",
            }}
          >
            ✕
          </button>
        )}
      </form>

      {/* Error */}
      {error && (
        <div
          className="text-[12px] px-4 py-3 rounded-[8px]"
          style={{ background: "oklch(25% 0.12 25 / 0.25)", border: "1px solid oklch(68% 0.22 25 / 0.30)", color: "var(--danger)" }}
        >
          {error}
        </div>
      )}

      {/* Reasoning banner */}
      {reasoning && (
        <div
          className="text-[12px] px-4 py-3 rounded-[8px] flex items-start gap-2"
          style={{ background: "oklch(25% 0.12 290 / 0.20)", border: "1px solid oklch(72% 0.22 290 / 0.25)", color: "var(--col-session)" }}
        >
          <span className="shrink-0 mt-[1px]">✦</span>
          <span>{reasoning}</span>
          {resultIds && (
            <span className="ml-auto shrink-0 opacity-60">
              {resultIds.length} match{resultIds.length !== 1 ? "es" : ""}
            </span>
          )}
        </div>
      )}

      {/* No results */}
      {resultIds !== null && resultIds.length === 0 && (
        <div className="text-[13px] text-center py-8" style={{ color: "var(--ink-2)" }}>
          No matching tasks found.
        </div>
      )}

      {/* Task list */}
      <div className="flex flex-col gap-2">
        {rankedTasks.map(({ task, matched }, i) => (
          <div key={task.id} className="relative">
            {resultIds && matched && i < resultIds.length && (
              <span
                className="absolute -left-5 top-1/2 -translate-y-1/2 text-[10px] font-bold w-4 text-right"
                style={{ color: "var(--col-session)", opacity: 0.6 }}
              >
                {i + 1}
              </span>
            )}
            <TaskCard
              task={task}
              entity={entities.find(e => e.id === task.entity_id)}
              onClick={() => onTaskClick(task)}
              showUrgency
              dimmed={resultIds !== null && !matched}
            />
          </div>
        ))}
      </div>

      {/* Empty state */}
      {openTasks.length === 0 && (
        <div className="text-center py-12" style={{ color: "var(--ink-2)" }}>
          <div className="text-[28px] mb-2">✅</div>
          <div className="text-[13px]">No open tasks</div>
        </div>
      )}
    </div>
  );
}
