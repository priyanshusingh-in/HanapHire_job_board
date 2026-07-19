"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function currentSeeker(profileId: string) {
  // Lazily created: the signup trigger only creates `profiles`, not the
  // seeker-specific extension row, so the first apply/save call creates it
  // (every field besides userId has a schema default).
  return prisma.seekerProfile.upsert({
    where: { userId: profileId },
    update: {},
    create: { userId: profileId },
  });
}

export async function applyToJob(jobId: string) {
  const profile = await requireRole(["SEEKER"]);
  const seeker = await currentSeeker(profile.id);

  await prisma.application.upsert({
    where: { jobId_seekerId: { jobId, seekerId: seeker.id } },
    update: {},
    create: { jobId, seekerId: seeker.id },
  });

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/dashboard");
}

export async function toggleSaveJob(jobId: string) {
  const profile = await requireRole(["SEEKER"]);
  const seeker = await currentSeeker(profile.id);
  const isSaved = seeker.savedJobIds.includes(jobId);

  await prisma.seekerProfile.update({
    where: { id: seeker.id },
    data: {
      savedJobIds: isSaved
        ? seeker.savedJobIds.filter((id) => id !== jobId)
        : [...seeker.savedJobIds, jobId],
    },
  });

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/dashboard");
}
