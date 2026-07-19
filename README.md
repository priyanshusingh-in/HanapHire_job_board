# HanapHire

On-demand job marketplace connecting gig/hourly workers with employers, with an AI Screening Agent that ranks applicants and drafts outreach. Next.js (App Router) + Supabase (Auth/Postgres/Storage/Realtime) + Prisma, built to run entirely on free tiers.

## Local development

1. Install dependencies: `npm install` (this also runs `prisma generate` via `postinstall`).
2. Copy `.env.example` to `.env` and fill in your **dev** Supabase project's values (see the comments in that file for exactly where to find each one in the Supabase dashboard).
3. Apply migrations: `npx prisma migrate deploy` (or `npx prisma migrate dev` for schema changes you're actively developing — note the shadow database can't validate migrations touching `auth.*`, so those must be applied with `migrate deploy`, not `migrate dev`; see the two migrations in `prisma/migrations/` for the pattern).
4. Seed sample data: `npm run db:seed` (creates seeded seeker/employer/admin accounts — see the script's console output for login credentials).
5. `npm run dev` and open [http://localhost:3000](http://localhost:3000).

## Branch strategy

Three long-lived branches, each deployed to its own Vercel environment against its own Supabase project:

- **`dev`** — integration branch. Feature branches merge here first.
- **`qa`** — staging/verification. PR from `dev` once a set of changes is ready to verify. Protected: PR + passing CI required.
- **`production`** — live. PR from `qa` once verified. Protected: PR + passing CI required.

CI (`.github/workflows/ci.yml`) runs lint + build on every PR/push to these three branches.

## Deploying (Vercel)

Each environment needs its own Supabase project (separate database, auth, storage) and its own set of environment variables in Vercel, scoped to that branch:

| Vercel setting | Git branch | Supabase project |
|---|---|---|
| Production environment | `production` | production project |
| Preview, scoped to `qa` | `qa` | qa project |
| Preview, scoped to `dev` (or general Preview default) | `dev` | dev project |

Set every variable from `.env.example` for each environment/branch scope in Vercel's Project Settings → Environment Variables. `NEXT_PUBLIC_SITE_URL` should be that environment's actual deployed URL.

The build command is `npm run vercel-build` (`prisma migrate deploy && next build`) — set this in Vercel's Project Settings → Build & Development Settings, or it's picked up automatically since it's a recognized script name. This means **every deploy automatically migrates that environment's own database** before building. The seed script never runs automatically — run `npm run db:seed` by hand against an environment only when you actually want seed data there (never against production).

In Vercel Project Settings → Git, set the **Production Branch** to `production`.
