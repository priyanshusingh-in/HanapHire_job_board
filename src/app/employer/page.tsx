import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: "text-success-text",
  CLOSED: "text-text-faint",
};

const APPLICANT_STATUS_STYLE: Record<string, string> = {
  APPLIED: "text-accent-hover",
  VIEWED: "text-text-faint",
  INTERVIEW: "text-warning-text",
  HIRED: "text-success-text",
  REJECTED: "text-danger",
};

export default async function EmployerDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ job?: string; posted?: string }>;
}) {
  const profile = await requireRole(["EMPLOYER"]);
  const { job: jobParam, posted } = await searchParams;

  const company = await prisma.company.findUnique({
    where: { ownerUserId: profile.id },
    include: {
      jobs: {
        orderBy: { postedAt: "desc" },
        include: { _count: { select: { applications: true } } },
      },
    },
  });

  const jobs = company?.jobs ?? [];
  const selectedJobId = jobParam ?? jobs[0]?.id;
  const selectedJob = jobs.find((j) => j.id === selectedJobId);

  const applicants = selectedJob
    ? await prisma.application.findMany({
        where: { jobId: selectedJob.id },
        orderBy: { appliedAt: "desc" },
        include: { seeker: { include: { user: { select: { name: true } } } } },
      })
    : [];

  const newApplicantsByJob = Object.fromEntries(
    await Promise.all(
      jobs.map(async (j) => [j.id, await prisma.application.count({ where: { jobId: j.id, status: "APPLIED" } })]),
    ),
  );

  // screeningCriteria is always stored as { raw: string } (see createJob),
  // even when the employer left the criteria field blank — so checking
  // Object.keys().length was always 1 > 0 regardless of actual content,
  // making every ACTIVE job with applicants look "agent eligible" even
  // with nothing for the agent to screen against.
  const criteriaRaw =
    selectedJob && selectedJob.screeningCriteria && typeof selectedJob.screeningCriteria === "object"
      ? (selectedJob.screeningCriteria as { raw?: unknown }).raw
      : undefined;
  const hasCriteria = typeof criteriaRaw === "string" && criteriaRaw.trim().length > 0;
  const isAgentEligible = selectedJob && selectedJob.status === "ACTIVE" && applicants.length > 0 && hasCriteria;

  return (
    <div>
      <h1 className="mb-6 font-serif text-[28px] font-medium tracking-tight">Your job postings</h1>

      {posted === "1" && selectedJob && (
        <div className="mb-6 border border-success px-5 py-3.5 text-[13.5px] text-success-text">
          &ldquo;{selectedJob.title}&rdquo; is live.
        </div>
      )}

      {jobs.length === 0 ? (
        <div className="border-t border-text-primary/14 py-10 text-center text-sm text-text-muted">
          You haven&apos;t posted a job yet.{" "}
          <Link href="/employer/jobs/new" className="text-accent-hover">
            Post your first job
          </Link>
          .
        </div>
      ) : (
        <div className="mb-9 flex flex-col">
          {jobs.map((job) => (
            <div
              key={job.id}
              className={`flex items-center justify-between border-t border-text-primary/12 py-4.5 ${
                job.id === selectedJobId ? "outline outline-offset-4 outline-accent" : ""
              }`}
            >
              <div className="min-w-0">
                <div className="mb-1 truncate font-serif text-lg">{job.title}</div>
                <div className="truncate text-[12.5px] text-text-muted">
                  {job._count.applications} applicants · {newApplicantsByJob[job.id] ?? 0} new · Posted{" "}
                  {relativeTime(job.postedAt)}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-4">
                <span className={`text-xs font-medium ${STATUS_STYLE[job.status]}`}>
                  {job.status === "ACTIVE" ? "Active" : "Closed"}
                </span>
                <Link
                  href={`/employer?job=${job.id}`}
                  className="rounded-md border border-text-primary/20 bg-white px-4 py-2 text-[13px] font-medium"
                >
                  View applicants
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedJob && (
        <>
          <div className="mb-4.5 font-serif text-xl">Applicants — {selectedJob.title}</div>

          {isAgentEligible && (
            <div className="mb-5 flex items-center justify-between border border-accent-ai px-6.5 py-5.5">
              <div>
                <div className="mb-1 font-serif text-[17px]">{applicants.length} applicants waiting to be reviewed</div>
                <div className="text-[13px] text-text-muted">
                  Let the AI Screening Agent rank candidates and draft outreach for your top matches.
                </div>
              </div>
              <Link
                href={`/employer/agent/${selectedJob.id}`}
                className="rounded-md bg-accent px-5 py-2.5 text-sm font-semibold whitespace-nowrap text-white"
              >
                Run AI Screening Agent →
              </Link>
            </div>
          )}

          <div className="flex flex-col">
            {applicants.map((a) => (
              <div key={a.id} className="flex items-center justify-between border-t border-text-primary/12 py-4">
                <div className="flex min-w-0 items-center gap-3.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f0eee7] font-serif text-[13px]">
                    {initials(a.seeker.user.name)}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-serif text-base">{a.seeker.user.name}</div>
                    <div className="truncate text-xs text-text-muted">
                      Applied {relativeTime(a.appliedAt)} · ★ {a.seeker.rating.toFixed(1)}
                    </div>
                  </div>
                </div>
                <span className={`shrink-0 text-xs font-medium ${APPLICANT_STATUS_STYLE[a.status]}`}>
                  {a.status === "APPLIED" ? "New" : a.status[0] + a.status.slice(1).toLowerCase()}
                </span>
              </div>
            ))}
            {applicants.length === 0 && (
              <div className="border-t border-text-primary/12 py-8 text-center text-sm text-text-muted">
                No applicants yet.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
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

function relativeTime(date: Date) {
  const ms = Date.now() - date.getTime();
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}
