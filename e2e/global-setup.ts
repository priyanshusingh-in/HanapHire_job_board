import "dotenv/config";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";
import { E2E_ADMIN, E2E_EMPLOYER, E2E_PASSWORD, E2E_SEEKER } from "./test-users";

// Playwright's own TS transform can't load the generated Prisma client
// (it uses import.meta.url, which its CJS-mode transform doesn't support —
// Next.js's own bundler handles this fine, this is purely a test-runner
// quirk), so this setup script talks to Postgres directly via `pg` instead.

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function ensureUser(email: string, name: string, role: "SEEKER" | "EMPLOYER" | "ADMIN") {
  const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
  const found = existing.users.find((u) => u.email === email);
  if (found) return found.id;

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: E2E_PASSWORD,
    email_confirm: true,
    user_metadata: { name },
    app_metadata: { role },
  });
  if (error || !data.user) throw error ?? new Error(`Failed to create ${email}`);
  return data.user.id;
}

export default async function globalSetup() {
  const seekerId = await ensureUser(E2E_SEEKER.email, E2E_SEEKER.name, "SEEKER");
  const employerId = await ensureUser(E2E_EMPLOYER.email, E2E_EMPLOYER.name, "EMPLOYER");
  await ensureUser(E2E_ADMIN.email, E2E_ADMIN.name, "ADMIN");

  const db = new Client({ connectionString: process.env.DIRECT_URL });
  await db.connect();
  try {
    // handle_new_user only fires on auth.users insert — profiles for
    // pre-existing e2e accounts (repeat runs) already exist from before.
    await db.query(
      `insert into public.profiles (id, email, name, role) values ($1,$2,$3,'SEEKER')
       on conflict (id) do nothing`,
      [seekerId, E2E_SEEKER.email, E2E_SEEKER.name],
    );
    await db.query(
      `insert into public.profiles (id, email, name, role) values ($1,$2,$3,'EMPLOYER')
       on conflict (id) do nothing`,
      [employerId, E2E_EMPLOYER.email, E2E_EMPLOYER.name],
    );

    // seeker-flow.spec.ts asserts an "Apply Now" button exists in the
    // Warehouse category — without this, repeat runs exhaust every job in
    // that category (each apply leaves a permanent Application row) and the
    // test has nothing left to click.
    await db.query(
      `delete from public.applications a using public.seeker_profiles sp
       where a."seekerId" = sp.id and sp."userId" = $1`,
      [seekerId],
    );

    let companyId: string;
    const companyRes = await db.query(`select id from public.companies where "ownerUserId" = $1`, [employerId]);
    if (companyRes.rows.length > 0) {
      companyId = companyRes.rows[0].id;
    } else {
      companyId = randomUUID();
      await db.query(
        `insert into public.companies (id, "ownerUserId", name, slug, industry, hq, founded, size, about)
         values ($1,$2,$3,$4,'General','Test City','2026','1–10 employees','E2E test fixture company.')`,
        [companyId, employerId, "E2E Test Co.", `e2e-test-co-${employerId.slice(0, 8)}`],
      );
    }

    let jobId: string;
    const jobRes = await db.query(
      `select id from public.jobs where title = 'E2E Flagged Test Listing' and "companyId" = $1`,
      [companyId],
    );
    if (jobRes.rows.length > 0) {
      jobId = jobRes.rows[0].id;
      // The admin-moderation test's own Remove action sets this job to
      // CLOSED and its flag to resolved=true — reset both here so re-runs
      // don't just keep piling a fresh "unresolved" flag onto a job that's
      // already been closed by the previous run (that's how 11 duplicate
      // "E2E Flagged Test Listing" rows accumulated in the dev DB).
      await db.query(`update public.jobs set status = 'ACTIVE' where id = $1`, [jobId]);
      await db.query(`delete from public.flagged_listings where "jobId" = $1`, [jobId]);
    } else {
      jobId = randomUUID();
      await db.query(
        `insert into public.jobs (id, "companyId", title, category, "payType", "payAmount", "payDisplay", location, shift, description, requirements, "screeningCriteria", "payDetails")
         values ($1,$2,'E2E Flagged Test Listing','Delivery','hourly',20,'$20/hr','Test City','Flexible','Fixture job for the admin moderation e2e test.','{}','{}','$20/hr')`,
        [jobId, companyId],
      );
    }

    await db.query(
      `insert into public.flagged_listings (id, "jobId", reason, severity, resolved)
       values ($1,$2,'E2E test flag','LOW',false)`,
      [randomUUID(), jobId],
    );
  } finally {
    await db.end();
  }
}
