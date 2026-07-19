"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBoss, SCREENING_QUEUE } from "@/lib/jobs/boss";

async function ownedJob(profileId: string, jobId: string) {
  const job = await prisma.job.findFirst({ where: { id: jobId, company: { ownerUserId: profileId } } });
  if (!job) throw new Error("Job not found");
  return job;
}

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
  if (existingRunning) return existingRunning;

  const run = await prisma.screeningRun.create({
    data: { jobId, status: "RUNNING", currentStep: 0, startedAt: new Date() },
  });

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
