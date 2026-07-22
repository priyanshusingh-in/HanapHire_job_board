import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AiAgentIndexPage() {
  const profile = await requireRole(["EMPLOYER"]);

  const jobs = await prisma.job.findMany({
    where: { status: "ACTIVE", company: { ownerUserId: profile.id }, applications: { some: {} } },
    orderBy: { postedAt: "desc" },
    include: { _count: { select: { applications: true } } },
  });

  if (jobs.length === 0) redirect("/employer");
  // Only one eligible job — skip the picker, same as before.
  if (jobs.length === 1) redirect(`/employer/agent/${jobs[0].id}`);

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1.5 font-serif text-[28px] font-medium tracking-tight">Screen &amp; rank applicants</h1>
      <p className="mb-6.5 text-sm text-text-muted">
        You have applicants across multiple jobs — pick which one to screen.
      </p>
      <div className="flex flex-col">
        {jobs.map((job) => (
          <Link
            key={job.id}
            href={`/employer/agent/${job.id}`}
            className="flex items-center justify-between border-t border-text-primary/14 py-4.5"
          >
            <div className="font-serif text-[15.5px]">{job.title}</div>
            <div className="text-[13px] text-text-muted">
              {job._count.applications} {job._count.applications === 1 ? "applicant" : "applicants"}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
