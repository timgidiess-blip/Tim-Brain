"use client";

import { useEffect, useState } from "react";
import Panel, { CardHeader } from "./Panel";
import type { FinanceSnapshot } from "@/app/api/finance/route";

// ── Theme ──────────────────────────────────────────────────────────────────────

const ACCENT = "var(--col-finance)";
const COL    = "var(--col-finance)";

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtNumber(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style:                 "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    // Fallback for unknown/local currency codes
    return `${currency} ${Math.round(n).toLocaleString()}`;
  }
}

function timeAgo(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const m    = Math.floor(diff / 60_000);
  if (m < 1)   return "just now";
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function fmtAsOf(dateStr: string): string {
  try {
    return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-GB", {
      day: "numeric", month: "short", year: "numeric",
    });
  } catch { return dateStr; }
}

// ── Category bar ──────────────────────────────────────────────────────────────

function CategoryBar({
  name, value, maxAbs, currency,
}: {
  name: string; value: number; maxAbs: number; currency: string;
}) {
  const pct      = maxAbs ? Math.abs(value) / maxAbs : 0;
  const isNeg    = value < 0;
  const barColor = isNeg ? "var(--danger)" : COL;

  return (
    <div className="flex items-center gap-[7px]">
      <span
        className="text-[10px] shrink-0 truncate"
        style={{ width: 72, color: "var(--ink-2)" }}
        title={name}
      >
        {name}
      </span>

      <div
        className="flex-1 h-[4px] rounded-full overflow-hidden"
        style={{ background: "var(--surface-2)" }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width:      `${Math.round(pct * 100)}%`,
            background: barColor,
            transition: "width 0.5s ease",
          }}
        />
      </div>

      <span
        className="text-[10px] font-mono shrink-0 text-right"
        style={{ width: 64, color: isNeg ? "var(--danger)" : "var(--ink-2)" }}
      >
        {isNeg ? "−" : ""}{fmtNumber(Math.abs(value), currency)}
      </span>
    </div>
  );
}

// ── Main card ──────────────────────────────────────────────────────────────────

export default function FinancePulseCard() {
  const [snapshot,    setSnapshot]    = useState<FinanceSnapshot | null>(null);
  const [loadError,   setLoadError]   = useState<string | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [refreshErr,  setRefreshErr]  = useState<string | null>(null);
  const [tick,        setTick]        = useState(0); // force re-render for "ago" label

  // ── Fetch latest snapshot (NO AI triggered) ──────────────────────────────
  useEffect(() => {
    setLoading(true);
    fetch("/api/finance")
      .then(r => r.json())
      .then((j: { snapshot?: FinanceSnapshot | null; error?: string }) => {
        if (j.error) { setLoadError(j.error); return; }
        setSnapshot(j.snapshot ?? null);
      })
      .catch(e => setLoadError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  // ── Tick "ago" label every minute ────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  void tick; // consumed only to trigger re-render

  // ── Manual refresh — POSTs to pipeline endpoint ───────────────────────────
  async function handleRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshErr(null);
    try {
      const res  = await fetch("/api/finance/snapshot", { method: "POST" });
      const json = await res.json() as { ok?: boolean; snapshot?: FinanceSnapshot; error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? "Refresh failed");
      if (json.snapshot) setSnapshot(json.snapshot);
    } catch (e) {
      setRefreshErr((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }

  // ── Derived values ────────────────────────────────────────────────────────
  const cats   = snapshot?.categories ?? [];
  const maxAbs = Math.max(...cats.map(c => Math.abs(c.value)), 1);

  // Separate assets and liabilities for the breakdown header
  const assets = cats.filter(c => c.value >= 0).reduce((s, c) => s + c.value, 0);
  const liabs  = cats.filter(c => c.value <  0).reduce((s, c) => s + Math.abs(c.value), 0);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Panel accent={ACCENT}>
      {/* Header with inline refresh button */}
      <div className="flex items-center justify-between mb-[13px]">
        <span
          className="text-[10px] font-bold tracking-[0.12em] uppercase"
          style={{ color: "var(--ink-2)" }}
        >
          Finance Pulse
        </span>
        <div className="flex items-center gap-[6px]">
          {snapshot?.snapshot_at && !refreshing && (
            <span className="text-[9px]" style={{ color: "var(--ink-2)" }}>
              {timeAgo(snapshot.snapshot_at)}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            title="Run fresh snapshot (calls AI)"
            className="w-[22px] h-[22px] rounded-[5px] flex items-center justify-center transition-all text-[12px]"
            style={{
              background: "var(--surface-2)",
              border:     `1px solid ${refreshing ? `color-mix(in oklch, ${COL} 40%, transparent)` : "var(--border)"}`,
              color:      refreshing ? COL : "var(--ink-2)",
            }}
          >
            <span
              style={{
                display:   "inline-block",
                animation: refreshing ? "spin 1s linear infinite" : "none",
              }}
            >
              ↻
            </span>
          </button>
        </div>
      </div>

      {/* ── Loading ─────────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <span className="text-[12px]" style={{ color: "var(--ink-2)" }}>Loading…</span>
        </div>
      )}

      {/* ── Error ───────────────────────────────────────────────────────── */}
      {!loading && loadError && (
        <div
          className="text-[11px] px-3 py-2 rounded-[7px]"
          style={{ background: "color-mix(in oklch, var(--danger) 12%, transparent)", border: "1px solid var(--danger)", color: "var(--danger)" }}
        >
          {loadError}
        </div>
      )}

      {/* ── No snapshot yet ─────────────────────────────────────────────── */}
      {!loading && !loadError && !snapshot && (
        <div className="text-center py-4">
          <div className="text-[12px] mb-3" style={{ color: "var(--ink-2)" }}>
            No snapshot yet.
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-3 py-[6px] rounded-[7px] text-[12px] font-semibold"
            style={{ background: COL, color: "#000", opacity: refreshing ? 0.5 : 1 }}
          >
            {refreshing ? "Running…" : "Run first sync"}
          </button>
        </div>
      )}

      {/* ── Snapshot data ───────────────────────────────────────────────── */}
      {!loading && snapshot && (
        <>
          {/* Net worth */}
          <div
            className="text-[24px] font-bold font-mono tracking-[-0.02em] leading-none"
            style={{ color: "var(--ink-0)" }}
          >
            {fmtNumber(snapshot.net_worth, snapshot.currency)}
          </div>

          {/* Sub-label */}
          <div className="flex items-center gap-2 mt-[4px] mb-[14px]">
            <span
              className="text-[9px] font-mono px-[6px] py-[1px] rounded-[20px]"
              style={{
                background: `color-mix(in oklch, ${COL} 10%, transparent)`,
                color:      COL,
                border:     `1px solid color-mix(in oklch, ${COL} 19%, transparent)`,
              }}
            >
              {snapshot.currency}
            </span>
            <span className="text-[10px]" style={{ color: "var(--ink-2)" }}>
              as of {fmtAsOf(snapshot.as_of)}
            </span>
          </div>

          {/* Asset / liability summary */}
          {(assets > 0 || liabs > 0) && (
            <div className="flex gap-3 mb-[12px]">
              {assets > 0 && (
                <div>
                  <div className="text-[9px] tracking-[0.08em] mb-[1px]" style={{ color: "var(--ink-2)" }}>
                    ASSETS
                  </div>
                  <div className="text-[12px] font-mono font-semibold" style={{ color: COL }}>
                    {fmtNumber(assets, snapshot.currency)}
                  </div>
                </div>
              )}
              {liabs > 0 && (
                <div>
                  <div className="text-[9px] tracking-[0.08em] mb-[1px]" style={{ color: "var(--ink-2)" }}>
                    LIABILITIES
                  </div>
                  <div className="text-[12px] font-mono font-semibold" style={{ color: "var(--danger)" }}>
                    {fmtNumber(liabs, snapshot.currency)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Category breakdown */}
          <div className="flex flex-col gap-[7px]">
            {cats.map(cat => (
              <CategoryBar
                key={cat.name}
                name={cat.name}
                value={cat.value}
                maxAbs={maxAbs}
                currency={snapshot.currency}
              />
            ))}
          </div>

          {/* Refresh error */}
          {refreshErr && (
            <div
              className="mt-3 text-[10px] px-2 py-[5px] rounded-[6px]"
              style={{ background: "color-mix(in oklch, var(--danger) 10%, transparent)", border: "1px solid var(--danger)", color: "var(--danger)" }}
            >
              {refreshErr}
            </div>
          )}

          {/* Refreshing overlay message */}
          {refreshing && (
            <div
              className="mt-3 text-[10px] px-2 py-[5px] rounded-[6px] text-center"
              style={{
                background: `color-mix(in oklch, ${COL} 7%, transparent)`,
                border:     `1px solid color-mix(in oklch, ${COL} 19%, transparent)`,
                color:      COL,
              }}
            >
              Running pipeline… Drive → Claude → Supabase
            </div>
          )}
        </>
      )}

      {/* CSS for spinner */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </Panel>
  );
}
