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
| `AUTH_SECRET` | HMAC key that signs the session cookie |
| `DASHBOARD_PASSWORD` | Optional — programmatic `x-api-secret` access (CLI/cron) |
| `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGIN` | Optional — override the passkey relying-party id / origin (defaults to the request host) |

## Authentication

Browser sign-in uses a **PIN** (default `0000`) plus optional **passkeys**
(Face ID on iPhone, Touch ID on Mac) via WebAuthn. The session itself is an
HMAC-signed cookie — PIN and passkey flows both just mint that cookie.

- **PIN** — the hash lives in the `auth_config` table and can be changed from
  the **⚙ Security** panel in the CRM. Until the `0002` migration is applied
  (or a PIN is set), login falls back to `0000`.
- **Passkeys** — enroll a device from the same Security panel while signed in,
  then use "Sign in with Face ID / Touch ID" on the login screen. Credentials
  live in `webauthn_credentials`.

### Database migration

Apply `supabase/migrations/0002_auth.sql` (auth tables) in your Supabase SQL
editor before relying on PIN persistence or passkeys. It is idempotent
(`CREATE TABLE IF NOT EXISTS …`).

## Theming

The theme is controlled by a `.dark` class on `<html>`. A no-flash inline
script in `app/layout.tsx` applies the saved (`tb:theme`) or system preference
before paint; the toggle in the top rail flips it. All colours are semantic
CSS tokens in `app/globals.css`, so components adapt to both themes
automatically.

## Tech

Next.js 15 (App Router) · React 19 · Tailwind v4 · Supabase (Postgres +
pgvector) · Anthropic & OpenAI SDKs.
