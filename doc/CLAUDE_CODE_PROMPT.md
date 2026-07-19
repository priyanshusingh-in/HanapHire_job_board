# Development Prompt: Build HanapHire (Production-Ready)

Paste everything below into Claude Code as your first message in a fresh repo (with `HanapHire.dc.html`, `README.md`, and `assets/` from this handoff folder attached/present in the repo root).

---

## 1. What you're building

HanapHire is a two-sided, on-demand job marketplace connecting gig/hourly workers ("seekers") with businesses that need to hire fast ("employers"), plus an internal admin console. The flagship feature is an **AI Screening Agent**: an autonomous background process that reads a job's screening criteria, scores every applicant against it, ranks them, and drafts personalized outreach messages for the employer to review and send.

A complete visual/interaction reference already exists at `HanapHire.dc.html` (open it in a browser — it's a self-contained HTML/React prototype) and is fully described in `README.md` in this same folder. **Treat both as the spec for layout, copy, colors, typography, states, and behavior.** They are prototypes, not code to copy verbatim — rebuild them properly in the stack below.

Build this as a **real, production-ready, deployable full-stack web application**, not a prototype.

---

## 2. Tech stack (use this unless you have a strong reason to deviate — ask first if so)

- **Framework**: Next.js 14+ (App Router), TypeScript throughout, strict mode on.
- **Styling**: Tailwind CSS, configured with the exact design tokens in §7 as theme extensions (colors, fonts, radii). Do not hardcode hex values inline — use Tailwind theme classes so the palette stays centrally editable.
- **Fonts**: Google Fonts `Newsreader` (400/500/600, italic variants) for display/serif text, `IBM Plex Sans` (400/500/600) for body/UI — load via `next/font/google`.
- **Database**: PostgreSQL. **Prisma** as ORM.
- **Auth**: NextAuth.js (Auth.js) with email/password (credentials provider + bcrypt hashing) at minimum; structure it so Google/LinkedIn OAuth can be added later. Three roles: `SEEKER`, `EMPLOYER`, `ADMIN`.
- **File/image storage**: Use a storage-agnostic interface (local disk in dev, S3-compatible bucket in prod) for company logos, profile photos, resumes.
- **Background jobs**: A real job queue (BullMQ + Redis, or a Postgres-backed queue like `pg-boss` if you want to avoid a Redis dependency) for the AI Screening Agent run — this must NOT block the request/response cycle; the UI polls or subscribes for status the same way the prototype's "running → done" states imply.
- **Realtime/notifications**: Use polling (simplest, reliable) or Server-Sent Events / WebSocket (better UX) so the employer dashboard shows "Screening complete" without a manual refresh, matching the prototype's "we'll notify you when it's done" copy.
- **Testing**: Vitest or Jest for unit tests, Playwright for e2e coverage of the critical flows in §9.
- **Deployment target**: Vercel (Next.js) + a managed Postgres (Neon/Supabase/RDS) + managed Redis if used. Provide a `README.md` with exact deploy steps and required environment variables (see §10).

---

## 3. AI Screening Agent — core feature, build this carefully

This is the product's single agentic AI feature. Implement it as follows:

### 3.1 Multi-vendor, key-rotating LLM client
Build a provider-agnostic `AgentLLMClient` module that:
- Accepts an ordered list of provider configs from environment variables, e.g.:
  ```
  AI_PROVIDERS=gemini,qwen,groq
  GEMINI_API_KEYS=key1,key2,key3
  QWEN_API_KEYS=key1,key2
  GROQ_API_KEYS=key1
  ```
  (Support multiple comma-separated keys **per provider** too, not just multiple providers — the ask was "many vendor api keys so if one expires or hits rate limit we can use another.")
- On each call, tries the current (provider, key) pair. On a 429 (rate limit), 401/403 (invalid/expired key), or 5xx, automatically advances to the next key in the current provider, then the next provider, retrying the same logical request — with capped exponential backoff and a max total attempt count (e.g. 6).
- Logs every failover (provider, key index, reason) server-side for observability, without ever logging full API keys.
- Exposes one function: `runScreeningCompletion({ systemPrompt, userPrompt, responseSchema })` that returns validated structured JSON (use each provider's JSON-mode/function-calling if available; otherwise parse-and-validate with retry-on-malformed-output up to 2 extra attempts).
- Free-tier providers to wire up initially (pick what's live and free at build time — verify current free-tier limits before committing, they change often):
  - Google **Gemini** (Gemini API free tier, e.g. `gemini-1.5-flash` / current equivalent)
  - Alibaba **Qwen** (via DashScope or OpenRouter's free Qwen models)
  - Optionally **Groq** (fast free-tier inference, useful as a low-latency fallback) and **OpenRouter's free model pool** as a catch-all fallback provider.
- Store keys ONLY in environment variables / a secrets manager — never in the DB or client bundle. Never expose provider identity or key state to the frontend.

### 3.2 Agent pipeline (per job, triggered by "Run AI Screening Agent")
Implement as a background job with these discrete steps (mirroring the prototype's step list — keep the step names identical so frontend copy matches):
1. **Reading job criteria & requirements** — load the job's structured screening criteria (skills/certs required, years experience, availability, location radius) from the DB.
2. **Scanning N applicant profiles** — load all applications for that job with the seeker's profile data (experience, certifications, availability, rating, distance).
3. **Scoring candidates against criteria** — call the LLM once per candidate (or batched, if the model handles it reliably) with a strict system prompt instructing it to output `{ matchScore: 0-100, rationale: string (<=200 chars, cite specific matched/missing criteria), recommendedAction: "approve"|"review"|"pass" }` as JSON. Validate matchScore is a number 0–100; reject and retry on malformed output.
4. **Ranking top matches** — sort by matchScore descending; persist all scores (not just top N) so the employer can see the full ranked list, defaulting the UI to showing top matches first (>=75 as in the prototype's "Excellent/Great Match" language is a reasonable default cutoff — make it configurable per job).
5. **Drafting personalized outreach messages** — for candidates above a configurable threshold (default: top 10 or score >= 75), call the LLM again to draft a short (<=400 char), first-name-personalized outreach message referencing 1-2 concrete reasons from that candidate's rationale. Store as a draft, editable, NOT sent automatically.
- Update a `ScreeningRun` record's status (`idle → running → done → failed`) and `currentStep` (0-4) as it progresses, so the frontend can render the exact running-state step list from the prototype.
- On completion, create an in-app notification (and, if email is configured, send one) to the employer: "Screening complete — N top matches found from M applicants."
- Employer actions on results: **Approve & Send** (send the drafted message via the employer's connected email/SMS — build an abstraction here too, start with email via Resend/SendGrid), **Edit** (edit draft text before sending), **Dismiss** (marks candidate as passed, no message sent). Persist each candidate's outreach status (`pending`/`sent`/`dismissed`) exactly as the prototype shows.
- Make the whole flow safely re-runnable ("Re-screen Applicants") without duplicating already-sent outreach.

### 3.3 Guardrails
- Never let the LLM auto-send anything — outreach is always employer-approved before sending (matches the prototype exactly; do not "improve" this into full autonomy without being asked).
- Rate-limit screening runs per employer (e.g. max 1 concurrent run per job) to avoid runaway API spend.
- Add a hard cap on applicants scored per run (e.g. 500) with pagination/backpressure beyond that.
- Sanitize all LLM output before rendering (no raw HTML injection) — render as plain text.

---

## 4. Roles & permissions

- **Seeker**: browse/search/save/apply to jobs, view own applications, manage profile.
- **Employer**: post/edit/close jobs, view applicants per job, run AI Screening Agent, approve/edit/dismiss outreach, view company profile.
- **Admin**: view platform stats, moderate flagged listings (review/remove), manage users (suspend/reactivate). Admin console is reachable only via the footer/menu "Admin console" link exactly as in the prototype — protect the route with role-based middleware (redirect non-admins).
- Enforce all of the above server-side (API route / server action guards), not just by hiding UI.

---

## 5. Pages & routes (map 1:1 to the prototype's "pages")

Public/marketing:
- `/` — Landing (hero, interactive "Looking for work / Hiring" widget wired to real data, how-it-works, featured jobs, testimonials, AI teaser)
- `/jobs` — Listings (category filter, search, sort — server-paginated)
- `/jobs/[id]` — Job detail
- `/companies/[slug]` — Company profile
- `/login`, `/signup` — with seeker/employer tab

Seeker app (authenticated, role=SEEKER):
- `/dashboard` — Applications / Saved Jobs tabs

Employer app (authenticated, role=EMPLOYER):
- `/employer` — job postings + applicants
- `/employer/jobs/new` — post a job
- `/employer/agent/[jobId]` — AI Screening Agent run + results

Admin (authenticated, role=ADMIN):
- `/admin` — Overview / Moderation Queue / Users tabs

Navigation chrome:
- Marketing pages: no persistent top bar. Two fixed floating elements — logo pill (top-left, links to `/`) and a circular menu button (top-right) opening a full-screen dark overlay with large serif nav links + login/signup + admin link, exactly as the prototype (reuse its animation timing/easing).
- App pages: left sidebar per role (Dashboard/Find Jobs for seeker; Dashboard/Post a Job/AI Screening Agent for employer; Overview/Moderation/Users tabs for admin), active item marked with a 2px left accent border only (no filled background) — not a filled pill.

---

## 6. Data model (Prisma schema — adapt field names as needed, but cover all of this)

```prisma
enum Role { SEEKER EMPLOYER ADMIN }
enum JobStatus { ACTIVE CLOSED }
enum ApplicationStatus { APPLIED VIEWED INTERVIEW HIRED REJECTED }
enum ScreeningStatus { IDLE RUNNING DONE FAILED }
enum OutreachStatus { PENDING SENT DISMISSED }
enum ListingSeverity { LOW MEDIUM HIGH }

model User {
  id            String   @id @default(cuid())
  email         String   @unique
  passwordHash  String
  role          Role
  name          String
  createdAt     DateTime @default(now())
  suspended     Boolean  @default(false)
  seekerProfile SeekerProfile?
  company       Company?  // for employers
}

model SeekerProfile {
  id             String   @id @default(cuid())
  userId         String   @unique
  user           User     @relation(fields: [userId], references: [id])
  rating         Float    @default(0)
  yearsExperience Json    // e.g. {category: years} or free text
  certifications String[]
  availability   String
  distanceRadiusMi Int
  savedJobIds    String[]
}

model Company {
  id          String  @id @default(cuid())
  ownerUserId String  @unique
  name        String
  slug        String  @unique
  industry    String
  hq          String
  founded     String
  size        String
  about       String
  rating      Float   @default(0)
  reviewCount Int     @default(0)
  logoUrl     String?
  bannerUrl   String?
}

model Job {
  id             String     @id @default(cuid())
  companyId      String
  company        Company    @relation(fields: [companyId], references: [id])
  title          String
  category       String
  payType        String     // hourly | fixed
  payAmount      Decimal
  payDisplay     String     // e.g. "$22/hr"
  location       String
  distanceMi     Float?
  shift          String
  urgent         Boolean    @default(false)
  verifiedEmployer Boolean  @default(false)
  status         JobStatus  @default(ACTIVE)
  description    String
  requirements   String[]
  screeningCriteria Json    // structured: [{label, type: 'cert'|'experience'|'availability'|'location', value}]
  payDetails     String
  postedAt       DateTime   @default(now())
  applications   Application[]
}

model Application {
  id           String   @id @default(cuid())
  jobId        String
  job          Job      @relation(fields: [jobId], references: [id])
  seekerId     String
  seeker       SeekerProfile @relation(fields: [seekerId], references: [id])
  status       ApplicationStatus @default(APPLIED)
  appliedAt    DateTime @default(now())
  matchScore   Int?
  rationale    String?
  outreachDraft String?
  outreachStatus OutreachStatus @default(PENDING)
}

model ScreeningRun {
  id          String   @id @default(cuid())
  jobId       String
  job         Job      @relation(fields: [jobId], references: [id])
  status      ScreeningStatus @default(IDLE)
  currentStep Int      @default(0)
  startedAt   DateTime?
  completedAt DateTime?
  totalScreened Int    @default(0)
  topMatchCount Int    @default(0)
  error       String?
}

model FlaggedListing {
  id          String   @id @default(cuid())
  jobId       String
  reason      String
  severity    ListingSeverity
  reportedAt  DateTime @default(now())
  resolved    Boolean  @default(false)
}
```

Adjust/normalize as you see fit, but every field the prototype displays must be backed by real, queryable data — no hardcoded arrays in production code.

---

## 7. Design tokens (exact — pull from `README.md` §Design Tokens, restated here for convenience)

- **Fonts**: `Newsreader` (serif/display, incl. italic), `IBM Plex Sans` (body/UI). No monospace.
- **Colors**:
  - `paper`: `#faf8f4` (page background)
  - `ink`: `#201a15` (dark sections: hero, footer, testimonial band, nav overlay)
  - `text-primary`: `#15130f`, `text-body`: `#3a3830`
  - `text-muted`: `#5c584f`, `text-faint`: `#8a857a`
  - `accent` (brand/primary CTA): `#c1502c`, hover `#8f3a1e`
  - `accent-ai` (AI Screening Agent + "Hiring" mode only): `#2f7d78`
  - `success`: `#1f9d6b`, `danger`: `#c0392b`, `warning`: `#b5730b`
  - Borders: `rgba(21,19,15,0.12–0.22)` on light surfaces, `rgba(245,243,238,0.12–0.3)` on dark surfaces
- **Radius**: 5–6px on buttons/inputs; 999px (fully round) on pills/avatars/toggle controls; everything else is flat/hairline-divided (no card-with-shadow pattern — lists use `border-top` dividers, not boxed cards with drop shadows).
- **Color usage rule (important)**: `accent` (terracotta) = general brand actions/links/highlights. `accent-ai` (teal) = reserved exclusively for AI Screening Agent UI and the employer/"Hiring" mode toggle — do not reuse teal elsewhere, and do not reuse terracotta for AI-specific elements. This is a deliberate two-accent system; preserve it.

---

## 8. Copy — reuse verbatim from the prototype
Do not rewrite marketing/UI copy. Pull all headline, body, button, and empty-state text directly from `HanapHire.dc.html` / `README.md`. If new copy is needed for states the prototype doesn't cover (error states, empty search results, email templates), match its tone: direct, confident, no exclamation points, no emoji.

---

## 9. Critical flows to cover with Playwright e2e tests
1. Seeker signs up → browses jobs → filters by category → applies to a job → sees it in Dashboard > Applications.
2. Employer signs up → posts a job with screening criteria → sees it in "Your job postings."
3. Employer runs the AI Screening Agent on a job with real applicants → sees running state progress through all 5 steps → sees ranked results with scores/rationale/drafts → approves one, dismisses another → statuses persist on reload.
4. Admin logs in → moderation queue → removes a flagged listing → it's gone on reload.
5. Provider failover: mock the primary AI provider returning 429, assert the agent completes successfully via the fallback provider (with a unit/integration test, not necessarily e2e).

---

## 10. Environment variables (document all of these in a checked-in `.env.example`)
```
DATABASE_URL=
NEXTAUTH_URL=
NEXTAUTH_SECRET=
REDIS_URL=                 # if using BullMQ
AI_PROVIDERS=gemini,qwen,groq
GEMINI_API_KEYS=
QWEN_API_KEYS=
GROQ_API_KEYS=
OPENROUTER_API_KEYS=       # optional catch-all fallback
EMAIL_PROVIDER_API_KEY=    # Resend/SendGrid for outreach + notifications
STORAGE_BUCKET_URL=
STORAGE_ACCESS_KEY=
STORAGE_SECRET_KEY=
```

---

## 11. Non-functional requirements
- **Accessibility**: semantic HTML, proper form labels, focus states, color contrast AA minimum (re-check the terracotta/teal accents on both light and dark backgrounds), keyboard-operable nav overlay (trap focus while open, close on Escape).
- **Performance**: server-render marketing pages (SEO matters for job listings — use dynamic metadata per job/company page), paginate/virtualize long job/applicant lists, debounce search input.
- **SEO**: `/jobs/[id]` and `/companies/[slug]` need real `<title>`/meta description/OpenGraph tags per record; sitemap.xml for active job listings.
- **Security**: hash passwords (bcrypt/argon2), CSRF protection on mutations, rate-limit auth endpoints, validate/sanitize all user input (job postings, profile text) server-side, role checks on every API route, never trust client-sent role/userId.
- **Responsive**: the prototype is desktop-first; adapt the sidebar layouts to a mobile drawer and stack the multi-column sections (hero, job detail, listings sidebar+list) at typical breakpoints (`sm`/`md`) — use your judgment for mobile-specific interaction patterns not shown in the prototype, staying consistent with its visual language (flat, hairline-divided, serif+sans pairing, two-accent color system).

---

## 12. Suggested build order
1. Scaffold Next.js + TypeScript + Tailwind with tokens from §7; wire up fonts.
2. Prisma schema + migrations + seed script (port the prototype's sample jobs/companies/candidates as seed data).
3. Auth (NextAuth, credentials, role-based middleware).
4. Marketing pages (static/SSR) with real DB-backed listings/search/filter.
5. Seeker flows (apply/save/dashboard).
6. Employer flows (post job/dashboard/applicants).
7. AI Screening Agent: LLM client with provider/key failover → background job → polling/SSE status → results UI → approve/dismiss/send.
8. Admin console.
9. Notifications (in-app + email) for screening completion.
10. Tests (unit for the LLM failover logic and scoring parsing; Playwright for the flows in §9).
11. Deploy to Vercel + managed Postgres/Redis; document steps in the repo README.

Ask clarifying questions before making a call on anything ambiguous (e.g., real payments/payroll, real background-check integration, SMS provider) — those are out of scope for this prototype and were never specified.
