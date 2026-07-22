import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { runScreeningCompletion } from "@/lib/ai/agent-llm-client";
import { sendEmail } from "@/lib/email";

const batchScoreSchema = z.object({
  results: z.array(
    z.object({
      applicationId: z.string(),
      matchScore: z.number().min(0).max(100),
      rationale: z.string().min(1).max(220),
      recommendedAction: z.enum(["approve", "review", "pass"]),
    }),
  ),
});

const batchDraftSchema = z.object({
  results: z.array(
    z.object({
      applicationId: z.string(),
      message: z.string().min(1).max(450),
    }),
  ),
});

const RECOMMENDED_ACTION_MAP = {
  approve: "APPROVE",
  review: "REVIEW",
  pass: "PASS",
} as const;

const OUTREACH_THRESHOLD_RANK = 10; // top N by score, subject to matchThreshold too

// Candidates are scored/drafted in one LLM call per batch instead of one
// call per candidate — a 6-candidate run went from up to 12 sequential
// calls (each paying full system-prompt overhead) down to 2. Chunked
// rather than one giant call so a single run's applicant count (up to the
// 500 hard cap) can't blow out a single prompt/response.
const SCORE_BATCH_SIZE = 20;
const DRAFT_BATCH_SIZE = 20;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

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
 * invocation. Resumable across ticks: scoring/drafting only ever target
 * candidates missing a matchScore/outreachDraft, so a re-fetch of the same
 * pg-boss job after a timeout naturally picks up where it left off without
 * separate position bookkeeping. Re-running a job that's already DONE is
 * safe — SENT/DISMISSED applications are left untouched, and already-scored
 * PENDING ones aren't re-scored (saves tokens; re-screen only costs LLM
 * calls for applicants that showed up since the last run).
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
  // Only candidates never scored before — re-screening no longer re-spends
  // tokens re-scoring people who haven't changed since last time (that used
  // to filter on outreachStatus === "PENDING" alone, so every re-screen
  // re-scored the whole still-pending pool). This also makes resuming after
  // a timeout automatic: already-scored candidates simply won't reappear
  // here on the next tick, no position-based bookkeeping needed.
  const toScore = applications.filter((a) => a.matchScore === null);
  let scoredCount = run.scoredCount;

  for (const batch of chunk(toScore, SCORE_BATCH_SIZE)) {
    const systemPrompt =
      "You are an applicant-screening assistant for HanapHire, a gig/hourly job marketplace. " +
      "Score how well EACH candidate matches a job's screening criteria, independently of the others. " +
      'Respond with ONLY a JSON object: { "results": [ { "applicationId": string (copy exactly as given), ' +
      '"matchScore": number 0-100, "rationale": string (<=200 characters, cite specific matched or missing ' +
      'criteria), "recommendedAction": "approve" | "review" | "pass" }, ... ] } — one entry per candidate listed.';

    const userPrompt = [
      `Job: ${job.title}`,
      `Screening criteria: ${criteriaText}`,
      "",
      "Candidates:",
      ...batch.map(
        (app) =>
          `- applicationId: ${app.id} | ${app.seeker.user.name} | Years experience: ${formatYearsExperience(app.seeker.yearsExperience)} | Certifications: ${app.seeker.certifications.join(", ") || "None listed"} | Availability: ${app.seeker.availability || "Not specified"} | Rating: ${app.seeker.rating.toFixed(1)}`,
      ),
    ].join("\n");

    const result = await runScreeningCompletion({ systemPrompt, userPrompt, responseSchema: batchScoreSchema });
    const byId = new Map(result.results.map((r) => [r.applicationId, r]));

    for (const app of batch) {
      const scored = byId.get(app.id);
      if (!scored) continue; // dropped by the model — stays unscored, a later re-screen will retry it
      await prisma.application.update({
        where: { id: app.id },
        data: {
          matchScore: Math.round(scored.matchScore),
          rationale: scored.rationale.slice(0, 200),
          recommendedAction: RECOMMENDED_ACTION_MAP[scored.recommendedAction],
          screenedAt: new Date(),
        },
      });
      scoredCount += 1;
    }
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

  for (const batch of chunk(outreachCandidates, DRAFT_BATCH_SIZE)) {
    const systemPrompt =
      "You draft short outreach messages from employers to gig-worker candidates for HanapHire, one per " +
      "candidate listed. Tone: direct, confident, no exclamation points, no emoji. Reference 1-2 concrete " +
      'reasons from each candidate\'s own rationale. Respond with ONLY a JSON object: { "results": [ { ' +
      '"applicationId": string (copy exactly as given), "message": string, <=400 characters, personalized ' +
      'with the candidate\'s first name }, ... ] } — one entry per candidate listed.';

    const userPrompt = [
      `Job: ${job.title} at company id ${job.companyId}`,
      "",
      "Candidates:",
      ...batch.map((app) => {
        const firstName = app.seeker.user.name.split(" ")[0] || app.seeker.user.name;
        return `- applicationId: ${app.id} | First name: ${firstName} | Match rationale: ${app.rationale}`;
      }),
    ].join("\n");

    const result = await runScreeningCompletion({ systemPrompt, userPrompt, responseSchema: batchDraftSchema });
    const byId = new Map(result.results.map((r) => [r.applicationId, r]));

    for (const app of batch) {
      const draft = byId.get(app.id);
      if (!draft) continue; // dropped by the model — left undrafted, a later re-screen will retry it
      await prisma.application.update({
        where: { id: app.id },
        data: { outreachDraft: draft.message.slice(0, 400) },
      });
    }
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
