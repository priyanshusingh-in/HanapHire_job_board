import "server-only";
import { prisma } from "@/lib/prisma";

export async function getAdminStats() {
  const [activeJobPosts, registeredWorkers, flaggedReports, sentOutreach] = await Promise.all([
    prisma.job.count({ where: { status: "ACTIVE" } }),
    prisma.seekerProfile.count(),
    prisma.flaggedListing.count({ where: { resolved: false } }),
    prisma.application.findMany({
      where: { outreachStatus: "SENT", outreachSentAt: { not: null } },
      select: { appliedAt: true, outreachSentAt: true },
    }),
  ]);

  // "Time to hire" would need a real hire-decision timestamp, which the
  // schema doesn't have — nothing in the app ever sets Application.status
  // to HIRED, so that metric was permanently stuck at "—" regardless of
  // real platform activity. Outreach approval (via the AI Screening Agent)
  // is the closest real, populated signal for "how fast does an applicant
  // hear back", so that's what this now measures.
  let avgTimeToOutreachLabel = "—";
  if (sentOutreach.length > 0) {
    const totalHours = sentOutreach.reduce((sum, a) => {
      const hours = (a.outreachSentAt!.getTime() - a.appliedAt.getTime()) / (1000 * 60 * 60);
      return sum + Math.max(hours, 0);
    }, 0);
    const avgHours = totalHours / sentOutreach.length;
    avgTimeToOutreachLabel = avgHours < 48 ? `${avgHours.toFixed(1)} hrs` : `${(avgHours / 24).toFixed(1)} days`;
  }

  return [
    { label: "Active job posts", value: activeJobPosts.toLocaleString() },
    // "Verified" implies a verification mechanism that doesn't exist on
    // SeekerProfile — this was counting every seeker profile ever created
    // under a name the data can't back up.
    { label: "Registered workers", value: registeredWorkers.toLocaleString() },
    { label: "Flagged reports", value: flaggedReports.toLocaleString() },
    { label: "Avg. time to outreach", value: avgTimeToOutreachLabel },
  ];
}

// Capped: without a `take`, an admin who falls behind on moderation (flags
// arriving faster than they're resolved) would render every unresolved row
// on every page load with no scroll/paging affordance.
const FLAGGED_LISTINGS_LIMIT = 100;

export async function getFlaggedListings() {
  return prisma.flaggedListing.findMany({
    where: { resolved: false },
    orderBy: { reportedAt: "desc" },
    take: FLAGGED_LISTINGS_LIMIT,
    include: { job: { include: { company: { select: { name: true } } } } },
  });
}

/**
 * `search` matches name or email — without it, an admin has no way to find
 * (and therefore moderate) any user outside the most recent `limit` sign-ups,
 * which is the platform's single most important moderation lever.
 */
export async function getRecentUsers(search?: string, limit = 30) {
  // Escape ILIKE wildcards (%, _) so a literal search term can't act as a pattern.
  const escaped = search?.replace(/[%_\\]/g, (c) => `\\${c}`);
  return prisma.profile.findMany({
    where: escaped
      ? {
          OR: [
            { name: { contains: escaped, mode: "insensitive" } },
            { email: { contains: escaped, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
