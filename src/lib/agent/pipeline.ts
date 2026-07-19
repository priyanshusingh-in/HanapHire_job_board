import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { runScreeningCompletion } from "@/lib/ai/agent-llm-client";
import { sendEmail } from "@/lib/email";

const scoreSchema = z.object({
  matchScore: z.number().min(0).max(100),
  rationale: z.string().min(1).max(220),
  recommendedAction: z.enum(["approve", "review", "pass"]),
});

const draftSchema = z.object({
  message: z.string().min(1).max(450),
});

const RECOMMENDED_ACTION_MAP = {
  approve: "APPROVE",
  review: "REVIEW",
  pass: "PASS",
} as const;

const OUTREACH_THRESHOLD_RANK = 10; // top N by score, subject to matchThreshold too

function formatScreeningCriteria(criteria: unknown): string {
  if (Array.isArray(criteria)) {
    return criteria
      .map((c) => (c && typeof c === "object" && "label" in c ? String((c as { label: unknown }).label) : String(c)))
      .join("; ");
  }
  if (criteria && typeof criteria === "object" && "raw" in criteria) {
    const raw = (criteria as { raw?: unknown }).raw;
    if (typeof raw === "string" && raw.trim()) return raw;
  }
  return "No specific screening criteria provided — evaluate general fit for the role.";
}

function formatYearsExperience(value: unknown): string {
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, string>);
    if (entries.length) return entries.map(([k, v]) => `${k}: ${v}`).join(", ");
  }
  return "Not specified";
}

async function setStep(runId: string, step: number) {
  await prisma.screeningRun.update({ where: { id: runId }, data: { currentStep: step } });
}

/**
 * Runs the full 5-step screening pipeline for a run synchronously within one
 * invocation. Resumable across ticks: candidates already scored in a prior
 * partial run are skipped (ordered by application id), so a re-fetch of the
 * same pg-boss job after a timeout continues rather than restarting.
 * Re-running a job that's already DONE is safe — SENT/DISMISSED applications
 * are left untouched, only PENDING ones are re-scored.
 */
export async function processScreeningRun(runId: string) {
  try {
    await runPipeline(runId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.screeningRun.update({
      where: { id: runId },
      data: { status: "FAILED", error: message.slice(0, 500) },
    });
    throw err;
  }
}

async function runPipeline(runId: string) {
  const run = await prisma.screeningRun.findUniqueOrThrow({
    where: { id: runId },
    include: { job: true },
  });
  if (run.status === "DONE") return;

  await prisma.screeningRun.update({
    where: { id: runId },
    data: { status: "RUNNING", startedAt: run.startedAt ?? new Date(), error: null },
  });

  // Step 0 — Reading job criteria & requirements
  await setStep(runId, 0);
  const job = run.job;
  const criteriaText = formatScreeningCriteria(job.screeningCriteria);

  // Step 1 — Scanning applicant profiles
  await setStep(runId, 1);
  const applications = await prisma.application.findMany({
    where: { jobId: job.id },
    orderBy: { id: "asc" },
    take: 500, // hard cap per run
    include: { seeker: { include: { user: { select: { name: true } } } } },
  });
  await prisma.screeningRun.update({ where: { id: runId }, data: { totalScreened: applications.length } });

  // Step 2 — Scoring candidates against criteria
  await setStep(runId, 2);
  const toScore = applications.filter((a) => a.outreachStatus === "PENDING");
  let scoredCount = run.scoredCount;

  for (const app of toScore.slice(run.scoredCount)) {
    const systemPrompt =
      "You are an applicant-screening assistant for HanapHire, a gig/hourly job marketplace. " +
      "Score how well a candidate matches a job's screening criteria. " +
      'Respond with ONLY a JSON object: { "matchScore": number 0-100, "rationale": string (<=200 characters, cite specific matched or missing criteria), "recommendedAction": "approve" | "review" | "pass" }.';

    const userPrompt = [
      `Job: ${job.title}`,
      `Screening criteria: ${criteriaText}`,
      `Candidate: ${app.seeker.user.name}`,
      `Years experience: ${formatYearsExperience(app.seeker.yearsExperience)}`,
      `Certifications: ${app.seeker.certifications.join(", ") || "None listed"}`,
      `Availability: ${app.seeker.availability || "Not specified"}`,
      `Rating: ${app.seeker.rating.toFixed(1)}`,
    ].join("\n");

    const result = await runScreeningCompletion({ systemPrompt, userPrompt, responseSchema: scoreSchema });

    await prisma.application.update({
      where: { id: app.id },
      data: {
        matchScore: Math.round(result.matchScore),
        rationale: result.rationale.slice(0, 200),
        recommendedAction: RECOMMENDED_ACTION_MAP[result.recommendedAction],
        screenedAt: new Date(),
      },
    });

    scoredCount += 1;
    await prisma.screeningRun.update({ where: { id: runId }, data: { scoredCount } });
  }

  // Step 3 — Ranking top matches (persisted via matchScore; no extra write needed beyond the count)
  await setStep(runId, 3);
  const scored = await prisma.application.findMany({
    where: { jobId: job.id, matchScore: { not: null } },
    orderBy: { matchScore: "desc" },
    include: { seeker: { include: { user: { select: { name: true } } } } },
  });
  const topMatches = scored.filter((a) => (a.matchScore ?? 0) >= job.matchThreshold);
  await prisma.screeningRun.update({ where: { id: runId }, data: { topMatchCount: topMatches.length } });

  // Step 4 — Drafting personalized outreach messages
  await setStep(runId, 4);
  const outreachCandidates = scored
    .filter((a) => a.outreachStatus === "PENDING" && (a.matchScore ?? 0) >= job.matchThreshold && !a.outreachDraft)
    .slice(0, OUTREACH_THRESHOLD_RANK);

  for (const app of outreachCandidates) {
    const firstName = app.seeker.user.name.split(" ")[0] || app.seeker.user.name;
    const systemPrompt =
      "You draft short outreach messages from employers to gig-worker candidates for HanapHire. " +
      "Tone: direct, confident, no exclamation points, no emoji. Reference 1-2 concrete reasons from the rationale. " +
      'Respond with ONLY a JSON object: { "message": string, <=400 characters, personalized with the candidate\'s first name }.';
    const userPrompt = [
      `Job: ${job.title} at company id ${job.companyId}`,
      `Candidate first name: ${firstName}`,
      `Match rationale: ${app.rationale}`,
    ].join("\n");

    const result = await runScreeningCompletion({ systemPrompt, userPrompt, responseSchema: draftSchema });

    await prisma.application.update({
      where: { id: app.id },
      data: { outreachDraft: result.message.slice(0, 400) },
    });
  }

  await prisma.screeningRun.update({
    where: { id: runId },
    data: { status: "DONE", completedAt: new Date(), currentStep: 4 },
  });

  const company = await prisma.company.findUnique({ where: { id: job.companyId }, include: { owner: true } });
  if (company) {
    const body = `${topMatches.length} top matches found from ${applications.length} applicants for ${job.title}.`;
    await prisma.notification.create({
      data: {
        profileId: company.ownerUserId,
        type: "SCREENING_COMPLETE",
        title: "Screening complete",
        body,
        relatedJobId: job.id,
        relatedScreeningId: runId,
      },
    });
    await sendEmail({ to: company.owner.email, subject: "Screening complete — HanapHire", text: body });
  }
}
