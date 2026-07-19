import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AgentPanel, type RunSnapshot } from "@/components/agent-panel";
import { CandidateCard, type Candidate } from "@/components/candidate-card";

function formatCriteria(criteria: unknown): string[] {
  if (Array.isArray(criteria)) {
    return criteria.map((c) => (c && typeof c === "object" && "label" in c ? String((c as { label: unknown }).label) : String(c)));
  }
  if (criteria && typeof criteria === "object" && "raw" in criteria) {
    const raw = (criteria as { raw?: unknown }).raw;
    if (typeof raw === "string" && raw.trim()) {
      return raw
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function initials(name: string) {
  return (
    name
      .split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

function yearsLabel(value: unknown) {
  if (value && typeof value === "object") {
    const entries = Object.values(value as Record<string, string>);
    if (entries[0]) return entries[0];
  }
  return "Experienced";
}

export default async function AiAgentPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const profile = await requireRole(["EMPLOYER"]);
  const { jobId } = await params;

  const job = await prisma.job.findFirst({
    where: { id: jobId, company: { ownerUserId: profile.id } },
    include: { _count: { select: { applications: true } } },
  });
  if (!job) notFound();

  const latestRun = await prisma.screeningRun.findFirst({
    where: { jobId },
    orderBy: { createdAt: "desc" },
  });

  const runSnapshot: RunSnapshot = latestRun
    ? { id: latestRun.id, status: latestRun.status, currentStep: latestRun.currentStep, error: latestRun.error }
    : null;

  const isDone = runSnapshot?.status === "DONE";
  const candidates: Candidate[] = [];
  let topMatchCount = 0;
  let totalScreened = job._count.applications;

  if (isDone) {
    const applications = await prisma.application.findMany({
      where: { jobId, matchScore: { not: null } },
      orderBy: { matchScore: "desc" },
      include: { seeker: { include: { user: { select: { name: true } } } } },
    });
    topMatchCount = applications.filter((a) => (a.matchScore ?? 0) >= job.matchThreshold).length;
    totalScreened = latestRun?.totalScreened || totalScreened;
    for (const a of applications) {
      if (!a.rationale || !a.matchScore) continue;
      candidates.push({
        applicationId: a.id,
        name: a.seeker.user.name,
        initial: initials(a.seeker.user.name),
        yearsExp: yearsLabel(a.seeker.yearsExperience),
        availability: a.seeker.availability || "Not specified",
        rating: a.seeker.rating,
        matchScore: a.matchScore,
        rationale: a.rationale,
        draftMessage: a.outreachDraft ?? "",
        outreachStatus: a.outreachStatus,
      });
    }
  }

  const criteriaChips = formatCriteria(job.screeningCriteria);

  return (
    <div className="max-w-3xl">
      <div className="mb-2 font-serif text-[15px] text-text-faint italic">AI Screening Agent · {job.title}</div>
      <h1 className="mb-5.5 font-serif text-[28px] font-medium tracking-tight">Screen &amp; rank applicants</h1>

      <div className="mb-6.5 border border-text-primary/14 bg-white p-6.5">
        <div className="mb-3 font-serif text-[15px]">Screening criteria (from job posting)</div>
        <div className="flex flex-wrap gap-4.5">
          {criteriaChips.length > 0 ? (
            criteriaChips.map((c) => (
              <span key={c} className="text-[13px] text-text-body">
                {c}
              </span>
            ))
          ) : (
            <span className="text-[13px] text-text-muted">No screening criteria set for this job.</span>
          )}
        </div>
      </div>

      <div className="mb-6.5">
        <AgentPanel jobId={job.id} applicantCount={job._count.applications} initialRun={runSnapshot} />
      </div>

      {isDone && (
        <>
          <div className="mb-6 flex items-center justify-between border border-success px-6 py-5">
            <div>
              <div className="mb-0.5 font-serif text-[17px] text-success-text">Screening complete</div>
              <div className="text-[13px] text-success-text">
                {topMatchCount} top matches found from {totalScreened} applicants
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-4.5">
            {candidates.map((c) => (
              <CandidateCard key={c.applicationId} candidate={c} />
            ))}
            {candidates.length === 0 && (
              <div className="border border-text-primary/14 p-8 text-center text-sm text-text-muted">
                No candidates scored yet.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
