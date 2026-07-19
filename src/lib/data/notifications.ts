import "server-only";
import { prisma } from "@/lib/prisma";

export async function getRecentNotifications(profileId: string, limit = 8) {
  return prisma.notification.findMany({
    where: { profileId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
