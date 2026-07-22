"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

export async function removeFlaggedListing(flaggedListingId: string) {
  await requireRole(["ADMIN"]);

  const flagged = await prisma.flaggedListing.findUnique({
    where: { id: flaggedListingId },
    include: { job: { include: { company: { include: { owner: true } } } } },
  });
  if (!flagged) return;

  await prisma.$transaction([
    prisma.flaggedListing.update({ where: { id: flaggedListingId }, data: { resolved: true } }),
    prisma.job.update({ where: { id: flagged.jobId }, data: { status: "CLOSED" } }),
  ]);

  const owner = flagged.job.company.owner;
  const body = `Your listing "${flagged.job.title}" was removed by an admin (reason: ${flagged.reason}).`;
  await prisma.notification.create({
    data: {
      profileId: owner.id,
      type: "LISTING_REMOVED",
      title: "Listing removed",
      body,
      relatedJobId: flagged.jobId,
    },
  });
  await sendEmail({ to: owner.email, subject: "A listing was removed — HanapHire", text: body });

  revalidatePath("/admin/moderation");
  revalidatePath("/admin");
  revalidatePath("/jobs");
}

export async function setUserSuspended(profileId: string, suspended: boolean) {
  const admin = await requireRole(["ADMIN"]);

  const target = await prisma.profile.findUnique({ where: { id: profileId } });
  if (!target) return;
  // The Suspend/Reactivate button is already hidden for ADMIN rows and for
  // the signed-in admin's own row, but that's UI-only — the server action
  // is reachable directly, and requireRole() redirects *any* suspended
  // user (including admins) straight out of /admin with no way back in.
  // Suspending an admin, or an admin suspending themselves, is therefore a
  // real full-lockout vector, not just a cosmetic one, if this isn't also
  // enforced here.
  if (target.role === "ADMIN") throw new Error("Admin accounts can't be suspended.");
  if (target.id === admin.id) throw new Error("You can't suspend your own account.");

  await prisma.profile.update({ where: { id: profileId }, data: { suspended } });

  const body = suspended
    ? "Your account has been suspended. Contact support if you believe this is a mistake."
    : "Your account has been reactivated — you can log in again.";
  await prisma.notification.create({
    data: {
      profileId: target.id,
      type: "ACCOUNT_STATUS_CHANGED",
      title: suspended ? "Account suspended" : "Account reactivated",
      body,
    },
  });
  await sendEmail({
    to: target.email,
    subject: suspended ? "Your account has been suspended — HanapHire" : "Your account has been reactivated — HanapHire",
    text: body,
  });

  revalidatePath("/admin/users");
}
