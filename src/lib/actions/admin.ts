"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function removeFlaggedListing(flaggedListingId: string) {
  await requireRole(["ADMIN"]);

  const flagged = await prisma.flaggedListing.findUnique({ where: { id: flaggedListingId } });
  if (!flagged) return;

  await prisma.$transaction([
    prisma.flaggedListing.update({ where: { id: flaggedListingId }, data: { resolved: true } }),
    prisma.job.update({ where: { id: flagged.jobId }, data: { status: "CLOSED" } }),
  ]);

  revalidatePath("/admin/moderation");
  revalidatePath("/admin");
  revalidatePath("/jobs");
}

export async function setUserSuspended(profileId: string, suspended: boolean) {
  await requireRole(["ADMIN"]);
  await prisma.profile.update({ where: { id: profileId }, data: { suspended } });
  revalidatePath("/admin/users");
}
