# Tim's Brain

Tim's Brain is a personal life-OS and lightweight CRM: capture anything from
Telegram (text or voice), let AI classify and route it, and review everything
on a modern dashboard — tasks, brain/notes, health, finance, goals and memory.

## Highlights

- **Telegram capture pipeline** — send a message or voice note; it's
  transcribed, classified (Claude → OpenAI → regex fallback), routed to the
  right table, embedded for semantic recall, and confirmed back to you.
- **Urgency overrides from chat** — tap 🔴 Today / 🟡 This Week / 🔵 This Month
  / ⚪ Someday / 🔑 Key under any captured task and the CRM updates instantly.
- **Modern UI** — responsive dashboard with a light/dark theme toggle, glassy
  cards and a cohesive token-based design system.
- **CRM** — kanban, smart and category views over your tasks.
- **Memory** — pgvector-backed semantic search across captures and tasks.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Required environment variables

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Database access |
| `ANTHROPIC_API_KEY` | Primary capture classifier (Claude) |
| `OPENAI_API_KEY` | Fallback classifier, Whisper transcription, embeddings |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_USER_ID`, `TELEGRAM_WEBHOOK_SECRET` | Telegram capture |
| `AUTH_PASSWORD`, `AUTH_SECRET` | Dashboard sign-in |

## Theming

The theme is controlled by a `.dark` class on `<html>`. A no-flash inline
script in `app/layout.tsx` applies the saved (`tb:theme`) or system preference
before paint; the toggle in the top rail flips it. All colours are semantic
CSS tokens in `app/globals.css`, so components adapt to both themes
automatically.

## Tech

Next.js 15 (App Router) · React 19 · Tailwind v4 · Supabase (Postgres +
pgvector) · Anthropic & OpenAI SDKs.
