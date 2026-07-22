"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

async function ownedPendingApplication(profileId: string, applicationId: string) {
  const app = await prisma.application.findFirst({
    where: { id: applicationId, job: { company: { ownerUserId: profileId } } },
    include: { seeker: { include: { user: true } }, job: { include: { company: true } } },
  });
  if (!app) throw new Error("Application not found");
  return app;
}

export async function approveAndSend(applicationId: string) {
  const profile = await requireRole(["EMPLOYER"]);
  const app = await ownedPendingApplication(profile.id, applicationId);

  // Idempotent: re-clicking (double submit, stale UI) never sends twice.
  if (app.outreachStatus !== "PENDING") return;
  if (!app.outreachDraft) throw new Error("No draft to send yet.");

  await sendEmail({
    to: app.seeker.user.email,
    subject: `${app.job.company.name} wants to connect about ${app.job.title}`,
    text: app.outreachDraft,
  });

  await prisma.application.update({
    where: { id: applicationId },
    data: { outreachStatus: "SENT", outreachSentAt: new Date() },
  });

  revalidatePath(`/employer/agent/${app.jobId}`);
}

export async function editOutreachDraft(applicationId: string, message: string) {
  const profile = await requireRole(["EMPLOYER"]);
  const app = await ownedPendingApplication(profile.id, applicationId);
  if (app.outreachStatus !== "PENDING") return;

  const trimmed = message.trim().slice(0, 400);
  if (!trimmed) throw new Error("Message can't be empty.");

  await prisma.application.update({ where: { id: applicationId }, data: { outreachDraft: trimmed } });
  revalidatePath(`/employer/agent/${app.jobId}`);
}

export async function dismissCandidate(applicationId: string) {
  const profile = await requireRole(["EMPLOYER"]);
  const app = await ownedPendingApplication(profile.id, applicationId);
  if (app.outreachStatus !== "PENDING") return;

  await prisma.application.update({ where: { id: applicationId }, data: { outreachStatus: "DISMISSED" } });
  revalidatePath(`/employer/agent/${app.jobId}`);
}
