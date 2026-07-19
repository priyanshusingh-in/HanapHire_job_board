import "server-only";
import { getCurrentProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Save/apply button state for the signed-in seeker, or null for anyone else
 * (anonymous visitor, employer, admin) — those pages still render fine
 * without it, just without save/apply affordances.
 */
export async function getSeekerState() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "SEEKER") return null;

  const seeker = await prisma.seekerProfile.findUnique({
    where: { userId: profile.id },
    include: { applications: { select: { jobId: true } } },
  });
  if (!seeker) return { savedJobIds: [] as string[], appliedJobIds: [] as string[] };

  return {
    savedJobIds: seeker.savedJobIds,
    appliedJobIds: seeker.applications.map((a) => a.jobId),
  };
}
