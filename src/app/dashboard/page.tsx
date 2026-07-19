import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const STATUS_COLOR: Record<string, string> = {
  APPLIED: "text-accent",
  VIEWED: "text-text-faint",
  INTERVIEW: "text-accent",
  HIRED: "text-success",
  REJECTED: "text-danger",
};

const STATUS_LABEL: Record<string, string> = {
  APPLIED: "Applied",
  VIEWED: "Viewed",
  INTERVIEW: "Interview",
  HIRED: "Hired",
  REJECTED: "Rejected",
};

export default async function SeekerDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const profile = await requireRole(["SEEKER"]);
  const { tab } = await searchParams;
  const activeTab = tab === "saved" ? "saved" : "applications";

  const seeker = await prisma.seekerProfile.findUnique({
    where: { userId: profile.id },
    include: {
      applications: {
        orderBy: { appliedAt: "desc" },
        include: { job: { include: { company: { select: { name: true } } } } },
      },
    },
  });

  const savedJobs = seeker?.savedJobIds.length
    ? await prisma.job.findMany({
        where: { id: { in: seeker.savedJobIds } },
        include: { company: { select: { name: true } } },
      })
    : [];

  return (
    <div>
      <h1 className="mb-6 font-serif text-[28px] font-medium tracking-tight">My Dashboard</h1>
      <div className="mb-6.5 flex border-b border-text-primary/14">
        <Link
          href="/dashboard?tab=applications"
          className={`-mb-px border-b-2 px-4 py-2.5 font-serif text-sm ${
            activeTab === "applications" ? "border-accent font-medium text-text-primary" : "border-transparent text-text-faint"
          }`}
        >
          Applications
        </Link>
        <Link
          href="/dashboard?tab=saved"
          className={`-mb-px border-b-2 px-4 py-2.5 font-serif text-sm ${
            activeTab === "saved" ? "border-accent font-medium text-text-primary" : "border-transparent text-text-faint"
          }`}
        >
          Saved Jobs
        </Link>
      </div>

      {activeTab === "applications" ? (
        <div className="flex flex-col">
          {(seeker?.applications ?? []).map((app) => (
            <div key={app.id} className="flex items-center justify-between border-t border-text-primary/12 py-4.5">
              <div>
                <div className="mb-0.5 font-serif text-lg">{app.job.title}</div>
                <div className="text-[12.5px] text-text-muted">
                  {app.job.company.name} · Applied {relativeTime(app.appliedAt)}
                </div>
              </div>
              <span className={`text-xs font-medium ${STATUS_COLOR[app.status]}`}>{STATUS_LABEL[app.status]}</span>
            </div>
          ))}
          {!seeker?.applications.length && (
            <div className="border-t border-text-primary/12 py-10 text-center text-sm text-text-muted">
              No applications yet.{" "}
              <Link href="/jobs" className="text-accent">
                Browse jobs
              </Link>{" "}
              to get started.
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col">
          {savedJobs.map((job) => (
            <Link
              key={job.id}
              href={`/jobs/${job.id}`}
              className="flex items-center justify-between border-t border-text-primary/12 py-4.5"
            >
              <div>
                <div className="mb-0.5 font-serif text-lg">{job.title}</div>
                <div className="text-[12.5px] text-text-muted">
                  {job.company.name} · {job.location}
                </div>
              </div>
              <span className="font-serif text-lg">{job.payDisplay}</span>
            </Link>
          ))}
          {savedJobs.length === 0 && (
            <div className="border-t border-text-primary/12 py-10 text-center text-sm text-text-muted">
              No saved jobs yet.{" "}
              <Link href="/jobs" className="text-accent">
                Browse jobs
              </Link>{" "}
              and save the ones you like.
            </div>
          )}
        </div>
      )}
    </div>
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
