"use client";

import { useEffect, useRef, useState } from "react";
import Panel, { CardHeader } from "./Panel";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Meal {
  id:        string;
  t:         string;   // "HH:MM"
  n:         string;   // name
  kcal:      number;
  p:         number;   // protein g
  c:         number;   // carbs g
  f:         number;   // fat g
  estimated: boolean;  // was AI-estimated
}

// ── Constants ──────────────────────────────────────────────────────────────────

const ACCENT   = "var(--col-nutrition)";
const COL      = "oklch(72% 0.19 158)";
const TARGETS  = { kcal: 2600, p: 150, c: 200, f: 67 } as const;
const R        = 38;
const CIRC     = 2 * Math.PI * R;

const MACRO_CFG = [
  { key: "p" as const, label: "Protein", fill: "oklch(72% 0.19 195)", unit: "g", target: TARGETS.p },
  { key: "c" as const, label: "Carbs",   fill: "oklch(80% 0.17  70)", unit: "g", target: TARGETS.c },
  { key: "f" as const, label: "Fat",     fill: COL,                   unit: "g", target: TARGETS.f },
];

// ── Date / time helpers ────────────────────────────────────────────────────────

/** Local-clock date string — never toISOString() to avoid UTC rollover. */
function localDateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function uid() { return Math.random().toString(36).slice(2, 9); }
function macroKcal(p: number, c: number, f: number) { return Math.round(4 * p + 4 * c + 9 * f); }
function pct(val: number, target: number) { return Math.min(100, Math.round((val / target) * 100)); }
function fmt1(n: number) { return Number.isInteger(n) ? String(n) : n.toFixed(1); }
function fmtKcal(n: number) { return n.toLocaleString(); }

// ── Inline editor sub-component ────────────────────────────────────────────────

interface EditorProps {
  form:             Meal;
  redistributing:   boolean;
  onChange:         (patch: Partial<Meal>) => void;
  onKcalCommit:     (kcal: number) => void;
  onMacroChange:    (key: "p" | "c" | "f", val: number) => void;
  onSave:           () => void;
  onDelete:         () => void;
  onCancel:         () => void;
}

function InlineEditor({
  form, redistributing, onChange, onKcalCommit, onMacroChange, onSave, onDelete, onCancel,
}: EditorProps) {
  const [confirmDel, setConfirmDel] = useState(false);

  const inputCls = "w-full rounded-[6px] px-2 py-[5px] text-[12px] outline-none";
  const inputStyle = {
    background: "var(--surface-2)",
    border:     "1px solid var(--border-strong)",
    color:      "var(--ink-0)",
  };

  return (
    <div
      className="rounded-[10px] p-[10px] flex flex-col gap-[8px]"
      style={{
        background:   "var(--surface)",
        border:       `1px solid ${COL}44`,
        backdropFilter: "blur(8px)",
      }}
      onClick={e => e.stopPropagation()}
    >
      {/* Name + time row */}
      <div className="flex gap-[6px]">
        <input
          value={form.n}
          onChange={e => onChange({ n: e.target.value })}
          onKeyDown={e => { if (e.key === "Enter") onSave(); if (e.key === "Escape") onCancel(); }}
          className={`flex-1 ${inputCls}`}
          style={inputStyle}
          placeholder="Meal name"
        />
        <input
          type="time"
          value={form.t}
          onChange={e => onChange({ t: e.target.value })}
          className={`w-[68px] ${inputCls}`}
          style={{ ...inputStyle, colorScheme: "dark" }}
        />
      </div>

      {/* kcal field (highlighted — computed from macros or triggers redistribute) */}
      <div>
        <label className="text-[9px] tracking-[0.08em] font-semibold mb-[3px] flex items-center gap-1"
               style={{ color: "var(--ink-2)" }}>
          KCAL
          {redistributing && (
            <span className="text-[8px]" style={{ color: COL }}>⟳ redistributing…</span>
          )}
        </label>
        <input
          type="number"
          min={0}
          step={5}
          value={form.kcal || ""}
          onChange={e => {
            const v = Math.max(0, parseFloat(e.target.value) || 0);
            onChange({ kcal: v });
            onKcalCommit(v);
          }}
          className={`w-full ${inputCls} font-mono font-semibold`}
          style={{ ...inputStyle, color: COL, border: `1px solid ${COL}55` }}
        />
      </div>

      {/* Macro row: P / C / F */}
      <div>
        <label className="text-[9px] tracking-[0.08em] font-semibold mb-[3px] block"
               style={{ color: "var(--ink-2)" }}>
          MACROS (g) — editing any field recomputes kcal
        </label>
        <div className="grid grid-cols-3 gap-[5px]">
          {MACRO_CFG.map(({ key, label, fill }) => (
            <div key={key}>
              <div className="text-[9px] mb-[2px] font-mono" style={{ color: fill }}>{label[0]}</div>
              <input
                type="number"
                min={0}
                step={0.1}
                value={form[key] || ""}
                onChange={e => onMacroChange(key, Math.max(0, parseFloat(e.target.value) || 0))}
                className={`w-full ${inputCls} font-mono`}
                style={{ ...inputStyle, borderColor: `${fill}55` }}
              />
            </div>
          ))}
        </div>
        <div className="text-[9px] text-right mt-[3px]" style={{ color: "var(--ink-2)" }}>
          check: {fmt1(form.p)}×4 + {fmt1(form.c)}×4 + {fmt1(form.f)}×9 = {macroKcal(form.p, form.c, form.f)} kcal
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-[5px] pt-[2px]">
        <button
          onClick={() => { if (confirmDel) onDelete(); else setConfirmDel(true); }}
          className="text-[11px] px-[8px] py-[4px] rounded-[5px] transition-all"
          style={
            confirmDel
              ? { background: "color-mix(in oklch, var(--danger) 18%, transparent)", border: "1px solid var(--danger)", color: "var(--danger)" }
              : { background: "transparent", border: "1px solid var(--border-strong)", color: "var(--ink-2)" }
          }
        >
          {confirmDel ? "Confirm" : "Delete"}
        </button>
        <div className="flex-1" />
        <button
          onClick={onCancel}
          className="text-[11px] px-[8px] py-[4px] rounded-[5px]"
          style={{ background: "transparent", border: "1px solid var(--border-strong)", color: "var(--ink-2)" }}
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          className="text-[11px] px-[10px] py-[4px] rounded-[5px] font-semibold"
          style={{ background: COL, color: "#000" }}
        >
          Save
        </button>
      </div>
    </div>
  );
}

// ── Main card ──────────────────────────────────────────────────────────────────

export default function NutritionCard() {
  const today  = localDateKey();
  const LS_KEY = `miles-nutrition-${today}`;

  const [meals,           setMeals]           = useState<Meal[]>([]);
  const [editingId,       setEditingId]       = useState<string | null>(null);
  const [editForm,        setEditForm]        = useState<Meal | null>(null);
  const [addText,         setAddText]         = useState("");
  const [adding,          setAdding]          = useState(false);
  const [redistributing,  setRedistributing]  = useState(false);

  const redistributeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const editFormRef       = useRef<Meal | null>(null);
  editFormRef.current     = editForm;

  // ── Persistence helpers ──────────────────────────────────────────────────────

  function persist(next: Meal[]) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    fetch(`/api/nutrition/log/${today}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ meals: next }),
    }).catch(console.error);
  }

  function applyMeals(next: Meal[]) {
    setMeals(next);
    persist(next);
  }

  // ── Mount: localStorage → Supabase sync ─────────────────────────────────────

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setMeals(JSON.parse(raw) as Meal[]);
    } catch { /* ignore */ }

    fetch(`/api/nutrition/log/${today}`)
      .then(r => r.json())
      .then((j: { meals?: Meal[] }) => {
        if (j.meals?.length) {
          setMeals(j.meals);
          try { localStorage.setItem(LS_KEY, JSON.stringify(j.meals)); } catch { /* ignore */ }
        }
      })
      .catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Computed totals ──────────────────────────────────────────────────────────

  const totals = meals.reduce(
    (acc, m) => ({ kcal: acc.kcal + m.kcal, p: acc.p + m.p, c: acc.c + m.c, f: acc.f + m.f }),
    { kcal: 0, p: 0, c: 0, f: 0 },
  );
  const kcalFraction = Math.min(1, totals.kcal / TARGETS.kcal);
  const kcalOffset   = CIRC * (1 - kcalFraction);
  const remaining    = Math.max(0, TARGETS.kcal - totals.kcal);
  const over         = totals.kcal > TARGETS.kcal;

  // ── Add meal via AI estimate ─────────────────────────────────────────────────

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!addText.trim() || adding) return;
    setAdding(true);
    try {
      const res  = await fetch("/api/nutrition/estimate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ text: addText.trim() }),
      });
      const json = await res.json() as { kcal?: number; p?: number; c?: number; f?: number; error?: string };
      if (json.error) throw new Error(json.error);

      const meal: Meal = {
        id:        uid(),
        t:         nowTime(),
        n:         addText.trim(),
        kcal:      json.kcal ?? 0,
        p:         json.p    ?? 0,
        c:         json.c    ?? 0,
        f:         json.f    ?? 0,
        estimated: true,
      };
      applyMeals([...meals, meal]);
      setAddText("");
    } catch (err) {
      console.error("[NutritionCard add]", err);
    } finally {
      setAdding(false);
    }
  }

  // ── Edit helpers ─────────────────────────────────────────────────────────────

  function startEdit(meal: Meal) {
    clearTimeout(redistributeTimer.current);
    setEditingId(meal.id);
    setEditForm({ ...meal });
  }

  function cancelEdit() {
    clearTimeout(redistributeTimer.current);
    setEditingId(null);
    setEditForm(null);
  }

  function saveEdit() {
    if (!editForm) return;
    applyMeals(meals.map(m => m.id === editForm.id ? { ...editForm } : m));
    setEditingId(null);
    setEditForm(null);
  }

  function deleteMeal() {
    if (!editForm) return;
    applyMeals(meals.filter(m => m.id !== editForm.id));
    setEditingId(null);
    setEditForm(null);
  }

  /** Editing a macro (p/c/f) → instantly recompute kcal. */
  function onMacroChange(key: "p" | "c" | "f", val: number) {
    setEditForm(f => {
      if (!f) return f;
      const next = { ...f, [key]: val };
      return { ...next, kcal: macroKcal(next.p, next.c, next.f), estimated: false };
    });
  }

  /** Editing kcal directly → debounce 600ms → call /redistribute. */
  function onKcalCommit(kcal: number) {
    clearTimeout(redistributeTimer.current);
    if (!kcal) return;
    redistributeTimer.current = setTimeout(async () => {
      const name = editFormRef.current?.n;
      if (!name) return;
      setRedistributing(true);
      try {
        const res  = await fetch("/api/nutrition/redistribute", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ name, kcal }),
        });
        const json = await res.json() as { p?: number; c?: number; f?: number };
        setEditForm(f => f ? { ...f, p: json.p ?? f.p, c: json.c ?? f.c, f: json.f ?? f.f } : f);
      } catch (err) {
        console.error("[NutritionCard redistribute]", err);
      } finally {
        setRedistributing(false);
      }
    }, 600);
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <Panel accent={ACCENT}>
      <CardHeader title="Nutrition" badge="Today" />

      {/* Calorie ring */}
      <div className="flex items-center gap-[14px] mb-[14px]">
        {/* SVG ring */}
        <div className="relative shrink-0" style={{ width: 88, height: 88 }}>
          <svg width={88} height={88} viewBox="0 0 88 88"
               style={{ transform: "rotate(-90deg)" }} aria-hidden>
            <circle cx={44} cy={44} r={R} fill="none"
                    stroke="var(--surface-2)" strokeWidth={7} />
            <circle cx={44} cy={44} r={R} fill="none"
                    stroke={over ? "var(--danger)" : COL}
                    strokeWidth={7}
                    strokeLinecap="round"
                    strokeDasharray={CIRC}
                    strokeDashoffset={meals.length ? kcalOffset : CIRC}
                    style={{ transition: "stroke-dashoffset 0.4s ease" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className="text-[18px] font-bold font-mono leading-none"
              style={{ color: over ? "var(--danger)" : COL }}
            >
              {fmtKcal(totals.kcal)}
            </span>
            <span className="text-[9px] mt-[2px]" style={{ color: "var(--ink-2)" }}>
              kcal
            </span>
          </div>
        </div>

        {/* Ring legend */}
        <div className="flex flex-col gap-[5px] flex-1">
          <div className="text-[11px]" style={{ color: "var(--ink-1)" }}>
            <span className="font-mono">{fmtKcal(TARGETS.kcal)}</span>
            <span style={{ color: "var(--ink-2)" }}> target</span>
          </div>
          <div className="text-[11px]" style={{ color: over ? "var(--danger)" : "var(--ink-2)" }}>
            {over
              ? <><span className="font-mono">{fmtKcal(totals.kcal - TARGETS.kcal)}</span> over</>
              : <><span className="font-mono">{fmtKcal(remaining)}</span> left</>
            }
          </div>
          <div className="text-[10px]" style={{ color: "var(--ink-2)" }}>
            {Math.round(kcalFraction * 100)}% of goal
          </div>
        </div>
      </div>

      {/* Macro bars */}
      <div className="flex flex-col gap-[6px] mb-[14px]">
        {MACRO_CFG.map(({ key, label, fill, target }) => {
          const val = totals[key];
          const p   = pct(val, target);
          return (
            <div key={key} className="flex items-center gap-[7px]">
              <span className="text-[10px] shrink-0 w-[42px]" style={{ color: "var(--ink-2)" }}>
                {label}
              </span>
              <div className="flex-1 h-[4px] rounded-full overflow-hidden"
                   style={{ background: "var(--surface-2)" }}>
                <div className="h-full rounded-full"
                     style={{
                       width: `${p}%`,
                       background: fill,
                       transition: "width 0.4s ease",
                     }} />
              </div>
              <span className="text-[10px] font-mono shrink-0 w-[42px] text-right"
                    style={{ color: p >= 100 ? fill : "var(--ink-2)" }}>
                {fmt1(val)}g
              </span>
            </div>
          );
        })}
      </div>

      {/* Divider + meal log */}
      <div style={{ borderTop: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between pt-[10px] mb-[7px]">
          <span className="text-[9px] font-bold tracking-[0.10em] uppercase"
                style={{ color: "var(--ink-2)" }}>
            Meal Log
          </span>
          <span className="text-[9px]" style={{ color: "var(--ink-2)" }}>
            {meals.length} meal{meals.length !== 1 ? "s" : ""}
          </span>
        </div>

        {meals.length === 0 && (
          <div className="text-center py-3 text-[11px]" style={{ color: "var(--ink-2)" }}>
            No meals logged yet
          </div>
        )}

        <div className="flex flex-col gap-[4px]">
          {meals.map(meal => (
            editingId === meal.id && editForm ? (
              <InlineEditor
                key={meal.id}
                form={editForm}
                redistributing={redistributing}
                onChange={patch => setEditForm(f => f ? { ...f, ...patch } : f)}
                onKcalCommit={onKcalCommit}
                onMacroChange={onMacroChange}
                onSave={saveEdit}
                onDelete={deleteMeal}
                onCancel={cancelEdit}
              />
            ) : (
              <button
                key={meal.id}
                onClick={() => startEdit(meal)}
                className="flex items-center w-full rounded-[6px] px-[8px] py-[7px] text-left transition-colors group"
                style={{ background: "transparent", border: "1px solid transparent" }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = "var(--surface-2)";
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                  (e.currentTarget as HTMLElement).style.borderColor = "transparent";
                }}
              >
                <span className="text-[10px] font-mono shrink-0 w-[32px]"
                      style={{ color: "var(--ink-2)" }}>
                  {meal.t}
                </span>
                <span className="flex-1 text-[12px] truncate mx-[6px]" style={{ color: "var(--ink-1)" }}>
                  {meal.estimated && (
                    <span className="mr-[3px] text-[9px]" style={{ color: COL }}>✦</span>
                  )}
                  {meal.n}
                </span>
                <span className="text-[12px] font-mono font-semibold shrink-0"
                      style={{ color: COL }}>
                  {fmtKcal(meal.kcal)}
                </span>
              </button>
            )
          ))}
        </div>
      </div>

      {/* Add meal */}
      <form
        onSubmit={handleAdd}
        className="flex gap-[6px] mt-[10px]"
      >
        <input
          value={addText}
          onChange={e => setAddText(e.target.value)}
          disabled={adding}
          className="flex-1 rounded-[7px] px-[9px] py-[6px] text-[12px] outline-none"
          style={{
            background: "var(--surface-2)",
            border:     "1px solid var(--border)",
            color:      "var(--ink-0)",
          }}
          placeholder={adding ? "Estimating…" : "+ Add meal or food…"}
        />
        <button
          type="submit"
          disabled={adding || !addText.trim()}
          className="shrink-0 px-[10px] py-[6px] rounded-[7px] text-[11px] font-bold tracking-[0.04em] transition-all"
          style={{
            background: adding ? "var(--surface-2)" : COL,
            color:      adding ? "var(--ink-2)" : "#000",
            opacity:    !addText.trim() && !adding ? 0.45 : 1,
            minWidth:   "42px",
          }}
        >
          {adding ? "…" : "AI"}
        </button>
      </form>

      {/* Estimated note */}
      {meals.some(m => m.estimated) && (
        <div className="mt-[6px] text-[9px]" style={{ color: "var(--ink-2)" }}>
          <span style={{ color: COL }}>✦</span> AI-estimated — click to edit
        </div>
      )}
    </Panel>
  );
}
