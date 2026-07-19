"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function markNotificationRead(notificationId: string) {
  const profile = await getCurrentProfile();
  if (!profile) return;

  await prisma.notification.updateMany({
    where: { id: notificationId, profileId: profile.id },
    data: { read: true },
  });
  revalidatePath("/", "layout");
}

export async function markAllNotificationsRead() {
  const profile = await getCurrentProfile();
  if (!profile) return;

  await prisma.notification.updateMany({
    where: { profileId: profile.id, read: false },
    data: { read: true },
  });
  revalidatePath("/", "layout");
}
