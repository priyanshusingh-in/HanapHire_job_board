import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AiAgentIndexPage() {
  const profile = await requireRole(["EMPLOYER"]);

  const job = await prisma.job.findFirst({
    where: { status: "ACTIVE", company: { ownerUserId: profile.id }, applications: { some: {} } },
    orderBy: { postedAt: "desc" },
  });

  redirect(job ? `/employer/agent/${job.id}` : "/employer");
}
