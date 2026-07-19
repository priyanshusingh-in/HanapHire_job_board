import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AiAgentPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const profile = await requireRole(["EMPLOYER"]);
  const { jobId } = await params;

  const job = await prisma.job.findFirst({
    where: { id: jobId, company: { ownerUserId: profile.id } },
  });
  if (!job) notFound();

  return (
    <div className="max-w-2xl">
      <div className="mb-2 font-serif text-[15px] text-text-faint italic">AI Screening Agent · {job.title}</div>
      <h1 className="mb-6 font-serif text-[28px] font-medium tracking-tight">Screen &amp; rank applicants</h1>
      <p className="text-sm text-text-muted">
        The full scoring, ranking, and outreach-drafting pipeline lands in checkpoint 3. This placeholder confirms
        the route, ownership check, and job lookup work.
      </p>
    </div>
  );
}
