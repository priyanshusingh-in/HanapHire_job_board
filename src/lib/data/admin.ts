import "server-only";
import { prisma } from "@/lib/prisma";

export async function getAdminStats() {
  const [activeJobPosts, verifiedWorkers, flaggedReports, hiredApplications] = await Promise.all([
    prisma.job.count({ where: { status: "ACTIVE" } }),
    prisma.seekerProfile.count(),
    prisma.flaggedListing.count({ where: { resolved: false } }),
    prisma.application.findMany({
      where: { status: "HIRED" },
      select: { appliedAt: true, job: { select: { postedAt: true } } },
    }),
  ]);

  let avgTimeToHireLabel = "—";
  if (hiredApplications.length > 0) {
    const totalHours = hiredApplications.reduce((sum, a) => {
      const hours = (a.appliedAt.getTime() - a.job.postedAt.getTime()) / (1000 * 60 * 60);
      return sum + Math.max(hours, 0);
    }, 0);
    const avgHours = totalHours / hiredApplications.length;
    avgTimeToHireLabel = avgHours < 48 ? `${avgHours.toFixed(1)} hrs` : `${(avgHours / 24).toFixed(1)} days`;
  }

  return [
    { label: "Active job posts", value: activeJobPosts.toLocaleString() },
    { label: "Verified workers", value: verifiedWorkers.toLocaleString() },
    { label: "Flagged reports", value: flaggedReports.toLocaleString() },
    { label: "Avg. time to hire", value: avgTimeToHireLabel },
  ];
}

export async function getFlaggedListings() {
  return prisma.flaggedListing.findMany({
    where: { resolved: false },
    orderBy: { reportedAt: "desc" },
    include: { job: { include: { company: { select: { name: true } } } } },
  });
}

export async function getRecentUsers(limit = 30) {
  return prisma.profile.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
