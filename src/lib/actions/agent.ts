"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { getBoss, SCREENING_QUEUE } from "@/lib/jobs/boss";

async function ownedJob(profileId: string, jobId: string) {
  const job = await prisma.job.findFirst({ where: { id: jobId, company: { ownerUserId: profileId } } });
  if (!job) throw new Error("Job not found");
  return job;
}

// A run stuck RUNNING past this long never got picked up by a tick (the
// fire-and-forget kickTick() failed, or — in production — the cron hasn't
// hit yet). Without this, startAgent's concurrency guard would return the
// same dead run forever with no way for the employer to retry, since the
// UI only offers a retry button for FAILED runs, not RUNNING ones.
const STALE_RUN_MS = 3 * 60 * 1000;

/** Kicks the tick endpoint immediately after enqueueing so the run starts within seconds instead of waiting for the next scheduled cron minute — fire-and-forget, the cron remains the reliable fallback. */
function kickTick() {
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  const secret = process.env.JOBS_TICK_SECRET;
  if (!site || !secret) return;
  fetch(`${site}/api/jobs/tick`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
  }).catch((err) => console.error("[startAgent] immediate tick kick failed", err));
}

export async function startAgent(jobId: string) {
  const profile = await requireRole(["EMPLOYER"]);
  await ownedJob(profile.id, jobId);

  const existingRunning = await prisma.screeningRun.findFirst({ where: { jobId, status: "RUNNING" } });
  if (existingRunning) {
    const runningSince = existingRunning.startedAt ?? existingRunning.createdAt;
    if (Date.now() - runningSince.getTime() < STALE_RUN_MS) return existingRunning;
    await prisma.screeningRun.update({
      where: { id: existingRunning.id },
      data: { status: "FAILED", error: "Timed out waiting for the background worker. Please try again." },
    });
  }

  let run;
  try {
    run = await prisma.screeningRun.create({
      data: { jobId, status: "RUNNING", currentStep: 0, startedAt: new Date() },
    });
  } catch (err) {
    // A concurrent call (e.g. a double-click) can race past the check
    // above before either commits — the partial unique index on
    // (jobId) WHERE status = 'RUNNING' (see migrations) rejects the
    // loser here instead of letting two runs process the same job at
    // once. Whichever call loses just returns the winner's run.
    const isConcurrentRunConflict = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
    if (!isConcurrentRunConflict) throw err;
    const winner = await prisma.screeningRun.findFirst({ where: { jobId, status: "RUNNING" } });
    if (!winner) throw err;
    return winner;
  }

  const boss = await getBoss();
  await boss.send(SCREENING_QUEUE, { runId: run.id });
  kickTick();

  revalidatePath(`/employer/agent/${jobId}`);
  return run;
}

/** Re-screen: safe to call on a DONE run — already-scored PENDING candidates get refreshed, SENT/DISMISSED ones are left alone (see pipeline.ts). */
export async function rescreenApplicants(jobId: string) {
  return startAgent(jobId);
}
