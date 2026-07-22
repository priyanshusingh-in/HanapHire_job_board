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
    include: { applications: { select: { jobId: true, status: true } } },
  });
  if (!seeker) return { savedJobIds: [] as string[], appliedJobIds: [] as string[], applicationStatusByJobId: {} };

  return {
    savedJobIds: seeker.savedJobIds,
    appliedJobIds: seeker.applications.map((a) => a.jobId),
    applicationStatusByJobId: Object.fromEntries(seeker.applications.map((a) => [a.jobId, a.status])),
  };
}

/** Apply-button label for a job the seeker has already applied to — REJECTED and HIRED get distinct copy instead of both looking identical to a still-open APPLIED. */
export function applicationStatusLabel(status: string | undefined) {
  if (status === "REJECTED") return "Not selected";
  if (status === "HIRED") return "Hired!";
  if (status) return "Applied ✓";
  return "Apply Now";
}
