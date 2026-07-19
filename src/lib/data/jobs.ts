import "server-only";
import { prisma } from "@/lib/prisma";

const activeJob = { status: "ACTIVE" as const };

export type JobSort = "relevant" | "pay" | "distance" | "newest";

export async function listJobs(opts: {
  category?: string;
  search?: string;
  sort?: JobSort;
  page?: number;
  pageSize?: number;
}) {
  const { category, search, sort = "relevant", page = 1, pageSize = 10 } = opts;

  const where = {
    ...activeJob,
    ...(category && category !== "All Categories" ? { category } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" as const } },
            { company: { name: { contains: search, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const orderBy =
    sort === "pay"
      ? [{ payAmount: "desc" as const }]
      : sort === "newest"
        ? [{ postedAt: "desc" as const }]
        : sort === "distance"
          ? [{ distanceMi: "asc" as const }]
          : [{ urgent: "desc" as const }, { postedAt: "desc" as const }];

  const [jobs, total] = await Promise.all([
    prisma.job.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { company: { select: { name: true } } },
    }),
    prisma.job.count({ where }),
  ]);

  return { jobs, total };
}

export async function getFeaturedJobs(limit = 3) {
  return prisma.job.findMany({
    where: activeJob,
    orderBy: [{ urgent: "desc" as const }, { postedAt: "desc" as const }],
    take: limit,
    include: { company: { select: { name: true } } },
  });
}

export async function getJobsByCategory(category: string | null, limit = 3) {
  return prisma.job.findMany({
    where: { ...activeJob, ...(category ? { category } : {}) },
    orderBy: [{ postedAt: "desc" as const }],
    take: limit,
    include: { company: { select: { name: true } } },
  });
}

export async function getJobById(id: string) {
  return prisma.job.findUnique({
    where: { id },
    include: { company: true, _count: { select: { applications: true } } },
  });
}

export async function getSimilarJobs(category: string, excludeId: string, limit = 3) {
  return prisma.job.findMany({
    where: { ...activeJob, category, id: { not: excludeId } },
    orderBy: [{ postedAt: "desc" as const }],
    take: limit,
    include: { company: { select: { name: true } } },
  });
}
