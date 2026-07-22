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
  const profile = await requireRole(["SEEKER"], { next: `/jobs/${jobId}` });

  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { status: true } });
  if (!job) throw new Error("This job posting no longer exists.");
  if (job.status !== "ACTIVE") throw new Error("This job is no longer accepting applications.");

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
  const profile = await requireRole(["SEEKER"], { next: `/jobs/${jobId}` });
  const seeker = await currentSeeker(profile.id);

  // Atomic toggle via a single UPDATE (array_append/array_remove evaluated
  // against the row's current value under Postgres's row-level lock) —
  // a read-then-write toggle here would let two overlapping calls (double
  // click, slow network + retry, two tabs) interleave: the second call's
  // read can observe the first call's already-committed write, silently
  // flipping the toggle one extra time relative to what either click
  // actually intended.
  await prisma.$executeRaw`
    UPDATE seeker_profiles
    SET "savedJobIds" = CASE
      WHEN ${jobId} = ANY("savedJobIds") THEN array_remove("savedJobIds", ${jobId})
      ELSE array_append("savedJobIds", ${jobId})
    END
    WHERE id = ${seeker.id}
  `;

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/dashboard");
}
