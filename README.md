# HanapHire

**On-demand hiring, made instant.** HanapHire is a two-sided marketplace that connects gig and hourly workers with the businesses that need them right now — same-day shifts, verified profiles, one-tap applications, and an AI agent that does an employer's first-pass candidate screening for them.

It's built to demonstrate a production-grade job marketplace end to end: real authentication and authorization, a real background-job pipeline driving a real multi-provider LLM integration, real-time UI updates, and an admin console — running entirely on free-tier infrastructure (Next.js on Vercel, Supabase for auth/database/storage/realtime).

---

## Table of contents

- [The problem](#the-problem)
- [Who it's for](#who-its-for)
- [Features](#features)
- [The AI Screening Agent](#the-ai-screening-agent)
- [Tech stack](#tech-stack)
- [Architecture notes](#architecture-notes)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Testing](#testing)
- [Deployment](#deployment)
- [Known limitations & roadmap](#known-limitations--roadmap)

---

## The problem

Hourly and gig hiring runs on urgency — a warehouse needs an overnight associate *tonight*, a delivery company needs coverage for a no-show *this afternoon*. Traditional job boards are built for salaried hiring cycles measured in weeks: long-form postings, ATS pipelines, manual resume screening. That mismatch costs both sides money — employers lose shifts to no-fill vacancies, and workers lose income to slow callbacks.

HanapHire narrows that gap on both ends: a seeker-facing experience built for fast browsing and one-tap applying, and an employer-facing AI agent that turns "read every application and reply to the good ones" — normally a multi-day chore — into a five-minute background job.

## Who it's for

| Role | What they come to do |
|---|---|
| **Job seekers** | Browse and filter shifts by category, pay, and distance; apply in one click; track application status; save jobs for later. |
| **Employers** | Post a job with plain-language screening criteria; let the AI agent read every applicant, rank them, and draft outreach; approve or edit the outreach before it ever sends. |
| **Admins** | Moderate flagged listings, manage user accounts, and watch platform health from one console. |

## Features

### For job seekers
- Browse/search/filter listings by category, keyword, pay, distance, and recency, with server-side pagination.
- One-click apply and save-for-later, both reflected instantly across the listing, detail, and dashboard views.
- A personal dashboard with **Applications** (status-aware — applied, viewed, interview, hired, or not selected) and **Saved Jobs** tabs.
- Company profiles showing an employer's other open roles and rating.

### For employers
- Post a job with pay, schedule, location, and free-text **screening criteria** the AI agent will evaluate candidates against.
- A postings dashboard showing every job, applicant counts, and new-applicant counts at a glance.
- **The AI Screening Agent** (see below) — the flagship feature.
- Per-candidate outreach controls: approve & send, edit the draft first, or dismiss — always a human decision, never fully automated.
- Real-time in-app + email notification the moment a screening run finishes.

### For admins
- **Overview**: live platform stats — active postings, registered workers, flagged reports, and average time-to-outreach.
- **Moderation queue**: review and remove flagged listings; removal closes the listing immediately (it stops appearing in search *and* stops accepting new applications) and notifies the employer with a reason.
- **User management**: search by name/email, suspend or reactivate accounts. Suspending an account is enforced server-side on every request, not just hidden in the UI — and an admin can't suspend another admin or themselves, so moderation can never lock out the whole admin team.

### Platform-wide
- Real-time UI updates (Supabase Realtime) for screening-run progress and notifications — no polling.
- Full keyboard/screen-reader support on every overlay and drawer (focus trap, Escape-to-close, focus restoration), WCAG AA color contrast throughout.
- Responsive down to mobile: a slide-out nav drawer on the app side, a full-screen menu overlay on the marketing site.
- SEO essentials: per-job/per-company metadata, `sitemap.xml`, `robots.txt`.

## The AI Screening Agent

This is the feature the rest of the product exists to support. An employer posts a job with criteria like *"Forklift certified, 1+ yr warehouse experience, available overnight"* — free text, no rigid form — and the agent does the rest as a background job:

1. **Reads** the job's criteria and requirements.
2. **Scans** every applicant's profile (experience, certifications, availability, rating).
3. **Scores** each one against the criteria (0–100) with a short, specific rationale.
4. **Ranks** the top matches against the job's configurable match threshold.
5. **Drafts** a personalized outreach message for each top match.

The employer sees this happen live — a five-step progress view driven by Supabase Realtime — then gets a ranked list of candidates with scores, rationale, and a drafted message per person. Nothing sends automatically: every message is **Approve & send**, **Edit draft**, or **Dismiss**, always a deliberate human click.

**How it's built to be fast, cheap, and resilient:**
- **Multi-provider LLM failover.** Gemini, Groq, DashScope (Qwen), and OpenRouter all expose an OpenAI-compatible `/chat/completions` endpoint, so one generic client (`src/lib/ai/agent-llm-client.ts`) serves all four. Each provider supports multiple comma-separated API keys; on a 429/401/403/5xx the client advances to the next key, then the next provider, with capped exponential backoff — configurable via `AI_PROVIDERS` and never hard-coded to one vendor.
- **Batched, not per-candidate.** Scoring and drafting each happen in one LLM call per batch of candidates (chunked at 500, the hard per-run cap) instead of one call per person — a 6-candidate run costs 2 LLM calls instead of up to 12, cutting both latency and token spend by roughly 85%.
- **Idempotent re-screening.** Re-running the agent on a job only spends tokens on candidates that don't already have a score — approved/dismissed candidates are never touched, and a candidate who already has a draft never gets a new one.
- **Serverless-safe background processing.** Vercel functions can't host a long-lived worker, so the pipeline runs on [pg-boss](https://github.com/timgit/pg-boss) (Postgres-backed queue, no Redis) pulled by a `POST /api/jobs/tick` endpoint on a 1-minute GitHub Actions cron, with per-candidate checkpointing so a run can resume mid-batch after a timeout instead of restarting. Starting a run also fires an immediate best-effort tick so the UI doesn't wait a full cron cycle.
- **Guardrails**: max one concurrent run per job (enforced by a database constraint, not just an application check — safe even under a double-click race), a hard 500-applicant cap per run, and a stale-run recovery path so a run that never got picked up by a tick doesn't leave the UI stuck forever.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router, Turbopack, Server Actions) |
| Language | TypeScript (strict) |
| UI | React 19, Tailwind CSS v4 (CSS-based design tokens) |
| Database | Postgres via [Supabase](https://supabase.com) |
| ORM | [Prisma 7](https://www.prisma.io) with driver adapters (`@prisma/adapter-pg`) |
| Auth | Supabase Auth (`@supabase/ssr`), email/password |
| Background jobs | [pg-boss](https://github.com/timgit/pg-boss) on the same Postgres instance |
| Realtime | Supabase Realtime (Postgres change subscriptions) |
| AI providers | Gemini, Groq, DashScope (Qwen), OpenRouter — all via one OpenAI-compatible client |
| Email | [Resend](https://resend.com) |
| Validation | [Zod](https://zod.dev) |
| Testing | [Vitest](https://vitest.dev) (unit) + [Playwright](https://playwright.dev) (e2e) |
| Hosting | [Vercel](https://vercel.com) |

Every piece of this stack has a free tier, and the app is designed to run entirely within them.

## Architecture notes

- **Prisma owns the data layer; Supabase owns auth, storage, and realtime.** All application reads/writes go through Prisma with a service-role connection — authorization is enforced in server-side code (`requireRole()` reading `profiles.role` from Postgres), never trusted from the client or from JWT claims. Supabase Realtime is the one place Row-Level Security is load-bearing, since that subscription runs through the browser's own Supabase client.
- **`raw_app_meta_data` vs. `raw_user_meta_data`.** Role assignment only ever trusts `app_metadata` (service-role-settable only); a user's own self-editable `user_metadata` is whitelisted to seeker/employer at signup and can never grant admin — closing the obvious privilege-escalation path in a system with public self-signup.
- **Two Postgres connection strings.** A pooled (PgBouncer) connection for the app's request-time queries, and a direct connection for migrations and for pg-boss (which needs session-level `LISTEN`/`NOTIFY`, incompatible with transaction pooling).
- **Two environments, two of everything.** Separate Vercel projects and separate Supabase projects for `dev` and `production` — not one project with environment branching — so a bad migration or a burned API quota in dev can never touch production.

## Project structure

```
src/
  app/                    Next.js App Router routes
    (marketing)/          Public site: landing, /jobs, /companies, auth pages
    dashboard/            Seeker dashboard
    employer/             Employer dashboard, job posting, AI agent UI
    admin/                Admin console
    api/jobs/tick/        Background-job tick endpoint
  components/             Shared React components
  lib/
    actions/              Server Actions (mutations)
    data/                 Server-side data-fetching functions (reads)
    ai/                   Multi-provider LLM client
    agent/                Screening pipeline
    jobs/                 pg-boss setup
    supabase/             Supabase client factories (browser/server/proxy)
    auth.ts               requireRole() / getCurrentProfile()
    prisma.ts             Prisma client singleton
  proxy.ts                Auth-presence gate (Next.js middleware)
prisma/
  schema.prisma           Data model
  migrations/             Versioned migrations (includes raw-SQL ones for
                           auth triggers, RLS policies, and constraints
                           Prisma's schema DSL can't express)
  seed.ts                 Sample data matching the original design prototype
e2e/                      Playwright end-to-end tests
```

## Getting started

1. Install dependencies: `npm install` (also runs `prisma generate` via `postinstall`).
2. Copy `.env.example` to `.env` and fill in your **dev** Supabase project's values (see the comments in that file for exactly where to find each one in the Supabase dashboard).
3. Apply migrations: `npx prisma migrate deploy` (or `npx prisma migrate dev` for schema changes you're actively developing — note the shadow database can't validate migrations touching `auth.*`, so those must be applied with `migrate deploy`, not `migrate dev`; see the raw-SQL migrations in `prisma/migrations/` for the pattern).
4. Seed sample data: `npm run db:seed` (creates seeded seeker/employer/admin accounts — see the script's console output for login credentials).
5. `npm run dev` and open [http://localhost:3000](http://localhost:3000).

## Environment variables

See `.env.example` for the full, commented list. Broadly:

- **Supabase**: project URL, anon key, service-role key.
- **Database**: pooled `DATABASE_URL` (app runtime) and direct `DIRECT_URL` (migrations + pg-boss).
- **AI providers**: `AI_PROVIDERS` (fallback order) plus comma-separated key lists per provider — drop any provider you don't have keys for and the client degrades gracefully.
- **Email**: Resend API key and from-address (sandbox mode until a domain is verified).
- **Background jobs**: `JOBS_TICK_SECRET` for authenticating the cron's calls to `/api/jobs/tick`.
- **App**: `NEXT_PUBLIC_SITE_URL` for that environment's actual deployed URL.

## Testing

- **Unit tests** (`npm run test`, Vitest): the LLM client's provider/key failover logic, including a mocked-429 test — the one flow the spec calls out as needing coverage without hitting a real provider.
- **End-to-end tests** (`npm run test:e2e`, Playwright, run against a production build for reliability): the critical user journeys —
  - Seeker signs up → browses → filters by category → applies → sees it in their dashboard.
  - Employer posts a job → sees it in their postings.
  - Employer runs the AI Screening Agent end to end → sees ranked results → approves one candidate, dismisses another → statuses persist on reload.
  - Admin removes a flagged listing → it's gone on reload.
- CI (`.github/workflows/ci.yml`) runs lint, unit tests, and a full build on every PR/push to `dev` and `production`. The Playwright suite isn't wired into CI — the AI-agent test hits real, rate-limited provider APIs and needs a seeded test project, so it's run manually before a deploy rather than on every commit.

## Deployment

Two long-lived branches, each its own Vercel project and its own Supabase project:

- **`dev`** — integration branch. Feature branches merge here first. Deploys to the `HanapHire-dev` Vercel project.
- **`production`** — live. PR from `dev` once verified. Protected: PR + passing CI required. Deploys to the `HanapHire-prod` Vercel project.

The build command is `npm run vercel-build` (`prisma migrate deploy && next build`), so **every deploy automatically migrates that environment's own database** before building. The seed script never runs automatically — run `npm run db:seed` by hand only when you actually want seed data in that environment (never in production).

A GitHub Actions cron hits each environment's `/api/jobs/tick` every minute to drive the screening pipeline in the background.

## Known limitations & roadmap

- **Email is sandbox-only.** Without a verified sending domain, Resend only delivers to the developer's own inbox — the approve → draft → send flow is fully functional, but real recipients won't receive outreach until a domain is verified.
- **Password auth only.** Google/LinkedIn OAuth is a pure Supabase-dashboard config change away (no code changes needed) but isn't turned on yet.
- **No payments or in-app messaging.** Out of scope for the current version — HanapHire connects and screens; it doesn't yet handle payroll or ongoing employer↔worker chat.
- **pg-boss on serverless is a known scaling watchpoint.** Each container may open its own direct database connection; under heavy concurrent tick invocations this could approach Supabase's connection limit before anything else does. Fine at demo scale, worth monitoring under real load.
