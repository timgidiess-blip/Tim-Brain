"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

// ── Constants ─────────────────────────────────────────────────────────────────

const KIND_EMOJI: Record<string, string> = {
  task:     "📋",
  note:     "📝",
  decision: "⚖️",
  reminder: "⏰",
  habit:    "🔄",
};

const URGENCY_LABEL: Record<string, string> = {
  today:      "Today",
  this_week:  "This Week",
  this_month: "This Month",
  someday:    "Someday",
};

const SOURCE_LABEL: Record<string, string> = {
  claude: "Claude",
  openai: "GPT",
  regex:  "pattern",
};

// ── Toast ─────────────────────────────────────────────────────────────────────

interface ToastData {
  id:       number;
  kind:     string;
  urgency:  string;
  summary:  string;
  llmSource: string;
  exiting:  boolean;
}

function Toast({
  toast,
  onDone,
}: {
  toast:  ToastData;
  onDone: (id: number) => void;
}) {
  const kindEmoji    = KIND_EMOJI[toast.kind]          ?? "📌";
  const urgencyLabel = URGENCY_LABEL[toast.urgency]    ?? toast.urgency;
  const sourceLabel  = SOURCE_LABEL[toast.llmSource]   ?? toast.llmSource;

  useEffect(() => {
    const exitTimer   = setTimeout(() => onDone(toast.id), 4200);
    return () => clearTimeout(exitTimer);
  }, [toast.id, onDone]);

  return (
    <div
      style={{
        animation: toast.exiting
          ? "toast-out 0.22s ease-in forwards"
          : "toast-in 0.22s ease-out forwards",
        background:     "var(--surface)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border:         "1px solid var(--border)",
        borderTop:      "1px solid var(--border-strong)",
      }}
      className="rounded-[10px] px-4 py-3 flex items-start gap-3 shadow-xl max-w-[420px] w-full"
    >
      <span className="text-base mt-px select-none">{kindEmoji}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span
            className="text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: "var(--col-session)" }}
          >
            {toast.kind}
          </span>
          <span className="text-[11px]" style={{ color: "var(--ink-2)" }}>
            ·
          </span>
          <span className="text-[11px]" style={{ color: "var(--ink-2)" }}>
            {urgencyLabel}
          </span>
          <span className="text-[11px]" style={{ color: "var(--ink-2)" }}>
            ·
          </span>
          <span className="text-[11px]" style={{ color: "var(--ink-2)" }}>
            {sourceLabel}
          </span>
        </div>
        <p
          className="text-[13px] leading-snug truncate"
          style={{ color: "var(--ink-0)" }}
        >
          {toast.summary}
        </p>
      </div>
    </div>
  );
}

// ── CaptureBox ────────────────────────────────────────────────────────────────

export default function CaptureBox() {
  const [expanded,  setExpanded]  = useState(false);
  const [text,      setText]      = useState("");
  const [loading,   setLoading]   = useState(false);
  const [toasts,    setToasts]    = useState<ToastData[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const toastCounter = useRef(0);

  // ── Auto-resize textarea ──────────────────────────────────────────────────
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [text]);

  // ── Global ⌘K → expand ───────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setExpanded(true);
        setTimeout(() => textareaRef.current?.focus(), 50);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Click-outside → collapse ──────────────────────────────────────────────
  useEffect(() => {
    if (!expanded) return;
    function onPointerDown(e: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setExpanded(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [expanded]);

  // ── Submit ────────────────────────────────────────────────────────────────
  const submit = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    try {
      const res = await fetch("/api/capture", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ text: trimmed }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json = (await res.json()) as { ok: boolean; result: any };
      const r    = json.result as {
        kind:      string;
        urgency:   string;
        summary:   string;
        llmSource: string;
      };

      const id = ++toastCounter.current;
      setToasts(prev => [
        ...prev,
        {
          id,
          kind:      r.kind,
          urgency:   r.urgency,
          summary:   r.summary,
          llmSource: r.llmSource,
          exiting:   false,
        },
      ]);

      // Auto-dismiss after 4s (toast-out animation starts at 4.2s)
      setTimeout(() => {
        setToasts(prev =>
          prev.map(t => (t.id === id ? { ...t, exiting: true } : t)),
        );
      }, 4000);

      setText("");
      setExpanded(false);
    } catch (err) {
      console.error("[CaptureBox] submit failed:", err);
    } finally {
      setLoading(false);
    }
  }, [text, loading]);

  const removeDoneToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // ── Keyboard handling inside textarea ─────────────────────────────────────
  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape") {
      setExpanded(false);
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void submit();
    }
  }

  // ── Panel glass style ─────────────────────────────────────────────────────
  const glassStyle: React.CSSProperties = {
    background:     "var(--surface)",
    backdropFilter: "blur(24px)",
    WebkitBackdropFilter: "blur(24px)",
    border:         "1px solid var(--border)",
    borderTop:      "1px solid var(--border-strong)",
  };

  return (
    <>
      {/* Toast stack — rendered above the capture box */}
      <div
        className="fixed z-50 flex flex-col gap-2 items-center pointer-events-none"
        style={{
          bottom:    expanded ? "160px" : "88px",
          left:      "50%",
          transform: "translateX(-50%)",
          transition: "bottom 0.22s ease",
        }}
      >
        {toasts.map(t => (
          <Toast key={t.id} toast={t} onDone={removeDoneToast} />
        ))}
      </div>

      {/* Capture box */}
      <div
        ref={containerRef}
        className="fixed z-40"
        style={{
          bottom:    "24px",
          left:      "50%",
          transform: "translateX(-50%)",
          width:     expanded ? "560px" : "320px",
          transition: "width 0.22s ease",
        }}
      >
        {/* ── Collapsed pill ─────────────────────────────────────────────── */}
        {!expanded && (
          <button
            type="button"
            onClick={() => {
              setExpanded(true);
              setTimeout(() => textareaRef.current?.focus(), 50);
            }}
            className="w-full flex items-center gap-3 rounded-full px-5 py-3 text-left transition-opacity hover:opacity-90 active:opacity-75"
            style={{
              ...glassStyle,
              borderRadius: "999px",
            }}
          >
            <span style={{ color: "var(--ink-2)", fontSize: "16px" }}>✏️</span>
            <span
              className="flex-1 text-[13px]"
              style={{ color: "var(--ink-2)" }}
            >
              Capture anything…
            </span>
            <kbd
              className="text-[11px] px-1.5 py-0.5 rounded-[4px]"
              style={{
                background: "var(--surface-2)",
                color:      "var(--ink-2)",
                border:     "1px solid var(--border)",
                fontFamily: "inherit",
              }}
            >
              ⌘K
            </kbd>
          </button>
        )}

        {/* ── Expanded panel ─────────────────────────────────────────────── */}
        {expanded && (
          <div
            className="rounded-[16px] overflow-hidden"
            style={glassStyle}
          >
            {/* Top shimmer */}
            <div
              aria-hidden
              className="h-px w-full pointer-events-none"
              style={{
                background:
                  "linear-gradient(90deg, transparent, var(--col-session) 50%, transparent)",
                opacity: 0.45,
              }}
            />

            <div className="px-4 pt-3 pb-3">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="What's on your mind? Task, note, decision…"
                rows={1}
                disabled={loading}
                className="w-full resize-none bg-transparent outline-none text-[14px] leading-relaxed placeholder:text-[var(--ink-2)] disabled:opacity-50"
                style={{
                  color:     "var(--ink-0)",
                  minHeight: "40px",
                  maxHeight: "180px",
                  overflow:  "auto",
                }}
              />
            </div>

            {/* Footer */}
            <div
              className="flex items-center justify-between px-4 py-2.5"
              style={{
                borderTop: "1px solid var(--border)",
              }}
            >
              <span
                className="text-[11px]"
                style={{ color: "var(--ink-2)" }}
              >
                <kbd style={{ fontFamily: "inherit" }}>Esc</kbd> to dismiss
              </span>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={!text.trim() || loading}
                className="flex items-center gap-2 rounded-[8px] px-3 py-1.5 text-[12px] font-medium transition-opacity disabled:opacity-40 hover:opacity-80 active:opacity-60"
                style={{
                  background: "var(--col-session)",
                  color:      "oklch(9% 0.020 255)",
                }}
              >
                {loading ? (
                  <span className="inline-block w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                ) : null}
                {loading ? "Saving…" : "Capture"}
                {!loading && (
                  <kbd
                    className="text-[10px] opacity-70"
                    style={{ fontFamily: "inherit" }}
                  >
                    ⌘↵
                  </kbd>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
