# Tim's Brain — Redesign Discovery

> Source of truth for the rebuild. Tim's answers captured verbatim, plus the
> design decisions they imply. Nothing is deleted from the codebase until the
> teardown phase (see `build-plan.md`). The **Telegram capture pipeline is
> preserved** and extended.

_Single user: Tim. This is his "second brain" — a place to remember things,
stay organized, and never let tasks slip. Not a sales CRM._

---

## Confirmed scope — 7 sections

Tasks · Brain/Notes · Health · Nutrition · Habits · Finance · Goals

UI model: **all seven as tabs on one page**, with a **roll-up strip at the top**
that surfaces the important bit of each section. Every page/dashboard is
**modular and customizable** — Tim can rearrange/show/hide widgets, with
**animated, reorderable lists** for habits, priorities, tasks, reminders, etc.
**Mobile-first** — Tim is on his phone on the go; full mobile access is required.
Keep the current **dark/light glassy theme** unless changed.

---

## 🧭 Big picture

1. **Morning screen:** today's tasks ordered by priority — must-do at top,
   deferrable below. Bonus: AI suggestions on *how* to get each one done.
2. **#1 thing he loses track of:** tasks — the various things he needs to do.
3. **Tabs + dashboard roll-up** (both).

## 🍎 Nutrition

4. **Targets (must be easily editable; change ~every 12 weeks):**
   - Calories ~2500–2600
   - Protein ~170g · Fat ~70g · Carbs = remainder
5. **Logging, ranked:**
   1. Sync from **MacroFactor** (or another food app) → feeds this DB.
      ⚠️ _Builder note: verify MacroFactor API/export — see build-plan integrations._
   2. **Natural-language / voice** logging via Telegram — "I had eggs" → adds egg,
      adjusts totals. Must be flexible.
   3. Food database — nice-to-have, not a priority now.
6. **Meals:** breakfast / lunch / dinner / snacks (macros split per meal).
7. **Food DB / external API:** not a priority yet.
8. **Also daily:** water ~4 L/day; supplements creatine + magnesium → tracked as
   **habit checkboxes** (not nutrition).

## 🏋️ Health & Exercise / Gym

9. **Weekly training:** gym 4×/wk · running 1–2×/wk · soccer 2×/wk.
10. **Gym tracking:** everything — exercises, sets, reps, weights. Currently in
    **Hevy**. ⚠️ _Pull/integrate Hevy data — verify Hevy API._
11. **Cardio:** tracked on a **watch**; pull watch data in rather than manual.
    ⚠️ _Open question: which watch/platform? (Apple / Garmin / etc.)_
12. **Body metrics:** weight (regular) + progress photos (~every 2 weeks). Both integrated.
13. **Exercise calories → nutrition:** keep **separate**. Training is already
    baked into his maintenance / cut / gain targets — **no eat-back**.

## 🔄 Habits

14. **Habits:** steps, water, reading (Bible), creatine, magnesium. Simple
    **done/not-done checkboxes**.
15. **No combined score** — habits, nutrition, workouts stay independent.

## ✅ Tasks

16. Keep **urgency tiers** (Today / This Week / This Month / Someday + Key).
    Add **due dates**, **projects**, and **recurring tasks**.

## 🧠 Brain/Notes · 💰 Finance · 🎯 Goals

17. **Brain/Notes:** dump for ideas / business ideas. These filter into their
    **own "future planning" area — NOT the to-do list** — treated as
    future/someday, found via a separate tab.
18. **Finance:** largely **automated**, with a general tracking bar on the site.
    One integrated system covering: income & expenses · invoices · tax
    (claim-backs) · stocks / where money goes · budgeting, bills, upcoming payments.
19. **Goals:** one **major goal per subcategory** to steer each area. AI suggests
    the best way to achieve each goal.

## 💬 Telegram + look & feel

20a. **Telegram = catch-all input.** Anything (log food, log workout, add task,
     etc.) added by messaging the bot from his phone. Priority: **speed/ease on
     the go**.
20b. **Mobile-first**, keep dark/light glassy theme unless told otherwise.

---

## Cross-cutting requirements

- **Modular dashboards:** per-section, drag/reorder, show/hide widgets;
  layout persisted per user.
- **Animated lists:** reorderable, animated lists for habits, priorities, tasks,
  reminders.
- **AI throughout:** classify captures, suggest how to do tasks, suggest how to
  hit goals.
- **Telegram extended** to log food / workouts / habits / tasks / notes, routed
  by the existing classify→route pipeline.
