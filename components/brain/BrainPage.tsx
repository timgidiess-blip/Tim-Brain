"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { MemoryChunk } from "@/app/api/memory/search/route";

// ── Type config ───────────────────────────────────────────────────────────────

const TYPE_META: Record<
  string,
  { icon: string; label: string; color: string; href?: (c: MemoryChunk) => string }
> = {
  capture: { icon: "📥", label: "Capture", color: "oklch(72% 0.19 255)" },
  task:    { icon: "✓",  label: "Task",    color: "oklch(72% 0.19 290)", href: () => "/crm" },
  habit:   { icon: "🌿", label: "Habit",   color: "oklch(72% 0.19 158)", href: () => "/health" },
  meal:    { icon: "🍽️", label: "Meal",    color: "oklch(80% 0.17  70)", href: () => "/health" },
  goal:    { icon: "🎯", label: "Goal",    color: "oklch(72% 0.19  20)", href: () => "/" },
};

const DEFAULT_META = { icon: "◆", label: "Memory", color: "oklch(60% 0.01 255)" };
function getTypeMeta(source_type: string) { return TYPE_META[source_type] ?? DEFAULT_META; }

// ── Formatting helpers ────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  const today = new Date();
  const pad   = (n: number) => String(n).padStart(2, "0");
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const yest    = new Date(today); yest.setDate(today.getDate() - 1);
  const yestStr  = `${yest.getFullYear()}-${pad(yest.getMonth() + 1)}-${pad(yest.getDate())}`;
  if (iso.startsWith(todayStr)) return "Today";
  if (iso.startsWith(yestStr))  return "Yesterday";
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// ── Similarity bar ────────────────────────────────────────────────────────────

function SimilarityBar({ value, color }: { value: number; color: string }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2 shrink-0">
      <div className="h-[3px] w-[48px] rounded-full overflow-hidden"
           style={{ background: "oklch(26% 0.02 255)" }}>
        <div className="h-full rounded-full transition-all"
             style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[10px] font-mono tabular-nums"
            style={{ color: "oklch(44% 0.018 255)" }}>
        {pct}%
      </span>
    </div>
  );
}

// ── Memory result card ────────────────────────────────────────────────────────

function ResultCard({ chunk, dimmed }: { chunk: MemoryChunk; dimmed?: boolean }) {
  const meta   = getTypeMeta(chunk.source_type);
  const href   = (meta as typeof TYPE_META[string]).href?.(chunk);
  const isTask = chunk.source_type === "task";
  const task   = chunk.source_row as Record<string, unknown> | null;

  const title = isTask && task?.title
    ? String(task.title)
    : chunk.text.length > 100 ? chunk.text.slice(0, 100) + "…" : chunk.text;

  const sub = isTask && task
    ? [
        task.urgency ? String(task.urgency).replace(/_/g, " ") : null,
        task.key ? "🔑 key" : null,
        task.completed_at ? "completed" : "open",
      ].filter(Boolean).join(" · ")
    : null;

  const inner = (
    <div
      className="group flex gap-3 px-4 py-3.5 rounded-[12px] transition-all cursor-pointer"
      style={{
        background:     "oklch(16% 0.028 255 / 0.55)",
        border:         `1px solid ${meta.color}22`,
        backdropFilter: "blur(12px)",
        opacity:        dimmed ? 0.45 : 1,
      }}
      onMouseEnter={e => {
        if (dimmed) return;
        (e.currentTarget as HTMLDivElement).style.background    = "oklch(18% 0.032 255 / 0.75)";
        (e.currentTarget as HTMLDivElement).style.borderColor   = `${meta.color}55`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.background    = "oklch(16% 0.028 255 / 0.55)";
        (e.currentTarget as HTMLDivElement).style.borderColor   = `${meta.color}22`;
      }}
    >
      <div className="flex items-center justify-center w-7 h-7 rounded-[7px] text-[13px] shrink-0 mt-0.5"
           style={{ background: `${meta.color}18` }}>
        {meta.icon}
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold tracking-[0.1em] uppercase"
                style={{ color: meta.color }}>
            {meta.label}
          </span>
          <span className="text-[9px]" style={{ color: "oklch(38% 0.018 255)" }}>
            {fmtDate(chunk.created_at)}
          </span>
        </div>
        <p className="text-sm leading-snug font-medium truncate"
           style={{ color: "oklch(88% 0.012 255)" }}>
          {title}
        </p>
        {sub && (
          <p className="text-[11px] mt-0.5" style={{ color: "oklch(46% 0.018 255)" }}>
            {sub}
          </p>
        )}
        {!isTask && (
          <p className="text-[11px] mt-0.5 line-clamp-2"
             style={{ color: "oklch(46% 0.018 255)" }}>
            {chunk.text}
          </p>
        )}
      </div>
      <div className="flex flex-col items-end justify-between shrink-0 gap-2">
        <SimilarityBar value={chunk.similarity} color={meta.color} />
        {href && (
          <span className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: meta.color }}>
            open →
          </span>
        )}
      </div>
    </div>
  );

  if (href) return <Link href={href} className="block no-underline">{inner}</Link>;
  return inner;
}

// ── Answer panel (Ask mode) ───────────────────────────────────────────────────

function AnswerPanel({
  answer,
  streaming,
  sources,
}: {
  answer:    string;
  streaming: boolean;
  sources:   MemoryChunk[];
}) {
  const COLOR = "oklch(72% 0.19 290)";

  return (
    <div className="flex flex-col gap-5">
      {/* Answer bubble */}
      <div
        className="rounded-[14px] px-5 py-4"
        style={{
          background:     "oklch(16% 0.028 255 / 0.65)",
          border:         `1px solid ${COLOR}33`,
          borderTop:      `2px solid ${COLOR}`,
          backdropFilter: "blur(16px)",
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[9px] font-bold tracking-[0.12em] uppercase"
                style={{ color: COLOR }}>
            ✦ Answer
          </span>
          {streaming && (
            <span className="text-[9px]" style={{ color: "oklch(50% 0.018 255)" }}>
              generating…
            </span>
          )}
        </div>
        <div
          className="text-[13.5px] leading-relaxed whitespace-pre-wrap"
          style={{ color: "oklch(84% 0.012 255)" }}
        >
          {answer || (streaming ? <span className="opacity-40">…</span> : null)}
          {streaming && answer && (
            <span
              className="inline-block w-[2px] h-[14px] ml-[1px] rounded-[1px] align-middle"
              style={{ background: COLOR, animation: "blink 1s step-end infinite" }}
            />
          )}
        </div>
      </div>

      {/* Sources */}
      {sources.length > 0 && (
        <div>
          <p className="text-[9px] font-bold tracking-[0.12em] uppercase mb-2 px-1"
             style={{ color: "oklch(40% 0.018 255)" }}>
            {sources.length} source{sources.length !== 1 ? "s" : ""} used
          </p>
          <div className="flex flex-col gap-2">
            {sources.map(c => <ResultCard key={c.id} chunk={c} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Empty / hint states ───────────────────────────────────────────────────────

function EmptyState({
  hint, searched, mode,
}: { hint?: string; searched: boolean; mode: "search" | "ask" }) {
  if (hint) {
    return (
      <div className="text-center py-16 px-6 rounded-[14px] mx-auto max-w-lg"
           style={{ background: "oklch(14% 0.024 255 / 0.6)", border: "1px solid oklch(25% 0.04 255)" }}>
        <p className="text-2xl mb-3">🧠</p>
        <p className="text-sm font-medium mb-1" style={{ color: "oklch(80% 0.012 255)" }}>
          Memory layer not yet enabled
        </p>
        <p className="text-[12px] leading-relaxed" style={{ color: "oklch(46% 0.018 255)" }}>
          {hint}
        </p>
        <a
          href="https://supabase.com/dashboard/project/ygcsmapamdgxiwxmbjia/sql/new"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-4 px-4 py-2 rounded-[8px] text-[12px] font-medium transition-opacity hover:opacity-80"
          style={{ background: "oklch(35% 0.14 290 / 0.3)", color: "oklch(72% 0.19 290)", border: "1px solid oklch(35% 0.14 290 / 0.4)" }}
        >
          Open Supabase SQL Editor →
        </a>
      </div>
    );
  }

  if (!searched) {
    return (
      <div className="text-center py-20">
        <p className="text-[40px] mb-4 opacity-40">🧠</p>
        {mode === "ask" ? (
          <>
            <p className="text-sm" style={{ color: "oklch(42% 0.018 255)" }}>
              Ask anything — Claude will answer from your memories
            </p>
            <p className="text-[11px] mt-2" style={{ color: "oklch(34% 0.018 255)" }}>
              Press Enter or click Ask ✦
            </p>
          </>
        ) : (
          <>
            <p className="text-sm" style={{ color: "oklch(42% 0.018 255)" }}>
              Search your memories semantically
            </p>
            <p className="text-[11px] mt-2" style={{ color: "oklch(34% 0.018 255)" }}>
              Captures · Tasks · Habits · Meals · Goals
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="text-center py-20">
      <p className="text-[40px] mb-4 opacity-30">◌</p>
      <p className="text-sm" style={{ color: "oklch(42% 0.018 255)" }}>
        No matching memories found
      </p>
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Mode = "search" | "ask";

// ── Main component ────────────────────────────────────────────────────────────

export default function BrainPage() {
  const [mode,      setMode]      = useState<Mode>("search");
  const [query,     setQuery]     = useState("");
  // Search state
  const [chunks,    setChunks]    = useState<MemoryChunk[]>([]);
  const [hint,      setHint]      = useState<string | undefined>();
  const [searched,  setSearched]  = useState(false);
  // Ask state
  const [answer,    setAnswer]    = useState("");
  const [streaming, setStreaming] = useState(false);
  const [sources,   setSources]   = useState<MemoryChunk[]>([]);
  const [asked,     setAsked]     = useState(false);
  // Shared
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const debounceRef  = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const abortRef     = useRef<AbortController | null>(null);
  const inputRef     = useRef<HTMLInputElement>(null);
  const modeRef      = useRef<Mode>("search");
  modeRef.current    = mode;

  // ── Search ────────────────────────────────────────────────────────────────

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setChunks([]); setHint(undefined); setSearched(false); setError(null);
      return;
    }
    setLoading(true); setError(null); setSearched(true);
    try {
      const res  = await fetch("/api/memory/search", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ query: trimmed, limit: 20 }),
      });
      const json = await res.json() as { chunks?: MemoryChunk[]; hint?: string; error?: string };
      if (!res.ok) { setError(json.error ?? "Search failed"); setChunks([]); }
      else         { setChunks(json.chunks ?? []); setHint(json.hint); }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Ask (SSE streaming) ───────────────────────────────────────────────────

  const runAsk = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;

    // Cancel any in-flight ask
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setAnswer(""); setSources([]); setAsked(true); setStreaming(true); setError(null); setLoading(true);

    try {
      const res = await fetch("/api/ask", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ query: trimmed, limit: 20 }),
        signal:  ctrl.signal,
      });

      if (!res.ok || !res.body) {
        setError("Ask endpoint unavailable");
        setStreaming(false);
        setLoading(false);
        return;
      }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let   buf     = "";

      setLoading(false);

      // Parse SSE chunks
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n\n");
        buf = lines.pop() ?? "";

        for (const block of lines) {
          const line = block.trim();
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6);
          try {
            const ev = JSON.parse(raw) as {
              type: string; delta?: string; chunks?: MemoryChunk[]; message?: string;
            };
            if (ev.type === "text" && ev.delta) {
              setAnswer(prev => prev + ev.delta!);
            } else if (ev.type === "sources" && ev.chunks) {
              setSources(ev.chunks);
            } else if (ev.type === "error") {
              setError(ev.message ?? "Unknown error");
              setStreaming(false);
              return;
            } else if (ev.type === "done") {
              setStreaming(false);
            }
          } catch { /* skip malformed */ }
        }
      }

    } catch (err: unknown) {
      if ((err as { name?: string }).name !== "AbortError") {
        setError("Network error — could not reach /api/ask");
      }
    } finally {
      setStreaming(false);
      setLoading(false);
    }
  }, []);

  // ── Input handlers ────────────────────────────────────────────────────────

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    if (modeRef.current === "search") {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => void runSearch(val), 420);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      clearTimeout(debounceRef.current);
      if (modeRef.current === "ask") void runAsk(query);
      else                           void runSearch(query);
    }
    if (e.key === "Escape") {
      clearAll();
    }
  }

  function clearAll() {
    setQuery(""); setChunks([]); setHint(undefined); setSearched(false);
    setAnswer(""); setSources([]); setAsked(false); setStreaming(false);
    setError(null); setLoading(false);
    abortRef.current?.abort();
    clearTimeout(debounceRef.current);
  }

  function switchMode(m: Mode) {
    setMode(m);
    // Re-run query in new mode if there's a query
    if (query.trim()) {
      clearTimeout(debounceRef.current);
      if (m === "ask")    void runAsk(query);
      else                void runSearch(query);
    }
    inputRef.current?.focus();
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  useEffect(() => {
    inputRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "/" && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => () => {
    clearTimeout(debounceRef.current);
    abortRef.current?.abort();
  }, []);

  // ── Derived state ─────────────────────────────────────────────────────────

  const isSearch    = mode === "search";
  const isAsk       = mode === "ask";
  const showEmpty   = !loading && !streaming && (isSearch ? chunks.length === 0 : !asked || (!answer && !streaming));
  const ACCENT      = "oklch(72% 0.19 290)";

  return (
    <div className="pt-6 pb-12">
      {/* ── Blink keyframe ─── */}
      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>

      {/* ── Mode toggle + search bar ──────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto mb-8">

        {/* Mode pills */}
        <div className="flex gap-1 mb-3">
          {(["search", "ask"] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className="px-3 py-1 rounded-[7px] text-[11px] font-semibold tracking-[0.06em] uppercase transition-all"
              style={{
                background: mode === m ? `${ACCENT}20` : "transparent",
                color:      mode === m ? ACCENT : "oklch(40% 0.018 255)",
                border:     `1px solid ${mode === m ? `${ACCENT}40` : "transparent"}`,
              }}
            >
              {m === "search" ? "⌕ Search" : "✦ Ask"}
            </button>
          ))}
        </div>

        {/* Input */}
        <div
          className="relative flex items-center rounded-[14px] overflow-hidden"
          style={{
            background:     "oklch(16% 0.028 255 / 0.65)",
            border:         `1px solid ${mode === "ask" ? `${ACCENT}40` : "oklch(28% 0.04 255)"}`,
            backdropFilter: "blur(16px)",
            boxShadow:      mode === "ask" ? `0 0 0 1px ${ACCENT}12` : "none",
          }}
        >
          <span
            className="pl-4 pr-2 text-base select-none"
            style={{ color: loading || streaming ? ACCENT : "oklch(38% 0.018 255)" }}
          >
            {(loading || streaming)
              ? <span className="inline-block animate-spin">◌</span>
              : isAsk ? "✦" : "⌕"}
          </span>

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={isAsk ? "Ask a question about your memories…" : "Search your memories…"}
            spellCheck={false}
            className="flex-1 bg-transparent py-4 pr-4 text-[15px] font-medium outline-none placeholder:font-normal"
            style={{ color: "oklch(88% 0.012 255)", caretColor: ACCENT }}
          />

          {/* Ask button (visible in Ask mode only) */}
          {isAsk && query.trim() && !streaming && (
            <button
              onClick={() => void runAsk(query)}
              className="mr-2 px-3 py-1 rounded-[7px] text-[11px] font-bold tracking-wide transition-opacity hover:opacity-80"
              style={{ background: `${ACCENT}22`, color: ACCENT, border: `1px solid ${ACCENT}44` }}
            >
              Ask ↵
            </button>
          )}

          {/* Clear */}
          {query && !streaming && (
            <button
              onClick={() => { clearAll(); inputRef.current?.focus(); }}
              className="pr-4 text-[18px] leading-none transition-opacity hover:opacity-60"
              style={{ color: "oklch(44% 0.018 255)" }}
              aria-label="Clear"
            >
              ×
            </button>
          )}
        </div>

        {/* Status line */}
        <div className="mt-2 h-4 px-1">
          {isSearch && !loading && searched && !hint && chunks.length > 0 && (
            <p className="text-[11px]" style={{ color: "oklch(38% 0.018 255)" }}>
              {chunks.length} result{chunks.length !== 1 ? "s" : ""}
            </p>
          )}
          {isAsk && streaming && (
            <p className="text-[11px]" style={{ color: "oklch(38% 0.018 255)" }}>
              Claude is thinking…
            </p>
          )}
          {error && (
            <p className="text-[11px]" style={{ color: "oklch(65% 0.18 20)" }}>
              {error}
            </p>
          )}
        </div>
      </div>

      {/* ── Results ─────────────────────────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto">

        {/* Search mode */}
        {isSearch && (
          showEmpty
            ? <EmptyState hint={hint} searched={searched} mode="search" />
            : (
              <div className="flex flex-col gap-2">
                {chunks.map(c => <ResultCard key={c.id} chunk={c} />)}
              </div>
            )
        )}

        {/* Ask mode */}
        {isAsk && (
          !asked && !streaming
            ? <EmptyState hint={hint} searched={false} mode="ask" />
            : (answer || streaming || sources.length > 0)
              ? <AnswerPanel answer={answer} streaming={streaming} sources={sources} />
              : showEmpty
                ? <EmptyState hint={hint} searched={asked} mode="ask" />
                : null
        )}
      </div>
    </div>
  );
}
