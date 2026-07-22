"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ALL_ROLES = ["SEEKER", "EMPLOYER", "ADMIN"] as const;

export async function markNotificationRead(notificationId: string) {
  const profile = await requireRole([...ALL_ROLES]);

  await prisma.notification.updateMany({
    where: { id: notificationId, profileId: profile.id },
    data: { read: true },
  });
  revalidatePath("/", "layout");
}

export async function markAllNotificationsRead() {
  const profile = await requireRole([...ALL_ROLES]);

  await prisma.notification.updateMany({
    where: { profileId: profile.id, read: false },
    data: { read: true },
  });
  revalidatePath("/", "layout");
}
