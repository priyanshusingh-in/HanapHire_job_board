# Handoff: HanapHire — On-Demand Job Board

## Overview
HanapHire is a two-sided marketplace connecting gig/hourly workers with businesses that need to hire quickly. Core differentiator: an **AI Screening Agent** that autonomously ranks job applicants against a job's criteria and drafts personalized outreach for the employer to approve.

## About the Design Files
The bundled `HanapHire.html` is a **design reference built as a single-file HTML/React prototype** (no build step, inline styles, simulated data/state). It is NOT production code to copy directly — recreate it in whatever stack you choose (Next.js/React recommended given the componentized structure already implied) using that stack's conventions (proper component files, a real router, a real backend/DB, real auth). Treat the HTML as the pixel/interaction spec.

## Fidelity
**High-fidelity.** Colors, type, spacing, copy, and every interaction (search/filter, save/apply, AI agent run simulation, admin actions) are final-intent. Recreate pixel-close using the target codebase's component library/design system if one exists; otherwise implement fresh using the tokens below.

## Screens / Views
1. **Landing** — dark hero (near-black `#201a15`) with eyebrow, serif headline ("Get hired today. / Hire in minutes." — second line italic), subcopy, two CTAs, and a horizontal trust-stat row with vertical hairline dividers. Below the hero: an interactive **"Looking for work / Hiring" toggle widget** (raised card, overlaps hero bottom edge by -64px) — chip-select by job category, live-filtered job cards (seeker mode) or available-worker sample + count (employer mode). Then: "How it works" (3-column numbered list), "Featured jobs" (flat row list, hairline dividers), dark testimonial band (2-col quotes), AI Screening Agent teaser (copy + screenshot).
2. **Job Listings** — 200px category sidebar + search input/sort select + job list (hairline-divided rows: title, company/location/distance, shift/urgent/verified tags, pay in serif numerals, Save/Apply buttons).
3. **Job Detail** — 2-column: description/requirements/pay (left, ~700px) + sticky apply card (right, 280px) + similar jobs list.
4. **Company Profile** — banner (striped placeholder), avatar-letter badge, about text, open roles list, stat card (founded/size/rating).
5. **Login / Signup** — centered 420px card, seeker/employer segmented tab (underline-style, not filled pill), form fields, single CTA.
6. **Seeker Dashboard** (app shell) — tabs: Applications (status pills) / Saved Jobs.
7. **Post a Job** (app shell, employer) — form: title, category, pay rate, location, shift, description, AI screening criteria textarea.
8. **Employer Dashboard** (app shell) — job postings list (click row to select), AI-eligible job shows a teal-bordered banner + "Run AI Screening Agent" CTA, applicant list for selected job.
9. **AI Screening Agent** (app shell) — CORE FEATURE. Three states:
   - *Idle*: criteria chips + "Start Agent" button.
   - *Running*: animated step list (5 steps, checkmarks fill in sequentially every ~850ms) + spinner, "notify when done" note.
   - *Done*: success banner + ranked candidate cards (match-score %, rationale, drafted outreach message, Approve & Send / Edit / Dismiss actions with live status).
10. **Admin Console** (app shell) — tabbed: Overview (stat blocks), Moderation Queue (flagged listings + Remove action), Users.

## Navigation Pattern
No traditional top nav bar. Two floating fixed elements over all marketing pages: a dark pill (top-left, logo only, links home) and a circular dark "hamburger" button (top-right) that opens a **full-screen dark overlay menu** with large italic-serif links (Find Work / Hire Talent / Company Directory) staggered fade-in, plus Log in / Post a Job buttons and a small Admin console link. App-shell pages (dashboards/agent/admin) use a conventional left sidebar instead, with active items marked by a 2px left accent border (no filled background).

## Interactions & Behavior
- **Category filter** (listings + hero widget): client-side filter over a static jobs array by category + text match on title/company.
- **Save / Apply**: toggles local state array; Apply pushes a new entry into the seeker's Applications list with status "Applied".
- **AI Agent run**: `Start Agent` → step index advances via `setTimeout` chain (850ms/step) → on last step, state → "done". `Approve & Send` / `Dismiss` mutate a candidate's status in place (pending → sent/dismissed), each with distinct inline (non-pill) status text.
- **Hero widget mode toggle**: "Looking for work" (terracotta active state) vs "Hiring" (teal active state) — swaps between job-match cards and worker-availability cards.
- Admin "Remove" button deletes a flagged-listing row from local state.
- All navigation is client-side state (`page` string) — no real routing; a real build should use actual routes (`/jobs`, `/jobs/:id`, `/dashboard`, `/employer/agent`, `/admin`, etc.).

## State Management (as prototyped — replace with real data layer)
- `page`, `navOpen`, `authRoleTab`
- `listingsCategory`, `listingsSearch`
- `selectedJobId`, `savedJobIds[]`, `applications[]`
- `heroMode` ('seeker'|'employer'), `heroCategory`
- `selectedEmployerJobId`, `agentState` ('idle'|'running'|'done'), `agentStepIndex`, `agentCandidates[]` (status: pending/sent/dismissed)
- `adminTab`, `flaggedListings[]`

## Design Tokens
**Typography**: Display/headings — `Newsreader` (serif, italic used for accent/eyebrow text and emphasis lines), weights 400/500/600. Body/UI — `IBM Plex Sans`, weights 400/500/600. No monospace in the final version.

**Colors**:
- Paper background: `#faf8f4`
- Ink/dark sections (hero, footer, testimonial, nav overlay): `#201a15`
- Text primary: `#15130f` / `#3a3830` (body copy)
- Text secondary/muted: `#5c584f`, `#8a857a` (on light), `rgba(245,243,238,0.55–0.7)` (on dark)
- **Primary accent (brand/CTA): `#c1502c`** (terracotta) — hover `#8f3a1e`
- **Secondary accent (AI feature + "Hiring" mode signal): `#2f7d78`** (deep teal) — used ONLY for AI Screening Agent branding (match score, spinner, rationale border, "eligible for AI" banner) and the employer-mode toggle
- Semantic: success `#1f9d6b`, danger `#c0392b`, warning `#b5730b` — kept distinct from the two brand accents
- Borders: `rgba(21,19,15,0.12–0.22)` on light, `rgba(245,243,238,0.12–0.3)` on dark

**Radii**: buttons/inputs 5–6px; pills/avatars 999px (fully round) — no other rounding (flat hairline-divided lists instead of rounded cards is the dominant list pattern).

**Shadows**: minimal — only on the raised hero widget card (`0 24px 60px rgba(21,19,15,0.12)`) and sticky apply card border (no shadow, hairline only elsewhere).

## Assets
- `assets/logo-cropped.png` — HanapHire wordmark+icon, transparent background (cropped tight to glyph bounds). Used with `filter: brightness(0) invert(1)` on dark surfaces to render white.
- `assets/hero-workers.png` — stock-style photo of three gig workers (not currently placed in final layout; was used in an earlier hero iteration, kept for reference/reuse).
- `assets/ai-agent-screenshot.png` — illustrative screenshot used in the landing page's AI Screening Agent teaser section.

Both `assets/logo-cropped.png` and `assets/ai-agent-screenshot.png` are actively referenced; recreate or replace with final brand assets in production.

## Files
- `HanapHire.html` — the full prototype (single file, all screens, inline styles, simulated logic).
- `assets/` — images referenced above.
