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

  // Prisma's `contains` compiles to Postgres ILIKE, where `%`/`_` are
  // wildcards — escape them so a literal search like "50%" only matches
  // that literal substring instead of acting as a pattern.
  const escapedSearch = search?.replace(/[%_\\]/g, (c) => `\\${c}`);

  const where = {
    ...activeJob,
    ...(category && category !== "All Categories" ? { category } : {}),
    ...(escapedSearch
      ? {
          OR: [
            { title: { contains: escapedSearch, mode: "insensitive" as const } },
            { company: { name: { contains: escapedSearch, mode: "insensitive" as const } } },
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

/**
 * True per-category active-job counts, for surfaces like the hero widget's
 * "See all N {category} jobs" — deriving that count from a capped sample
 * (e.g. the top 100 most-recent jobs) undercounts once total listings
 * exceed the cap, since jobs outside the sample are invisible to it.
 */
export async function getJobCountsByCategory() {
  const grouped = await prisma.job.groupBy({
    by: ["category"],
    where: activeJob,
    _count: true,
  });
  return Object.fromEntries(grouped.map((g) => [g.category, g._count]));
}

export async function getJobsByCategory(category: string | null, limit = 3) {
  return prisma.job.findMany({
    where: { ...activeJob, ...(category ? { category } : {}) },
    orderBy: [{ postedAt: "desc" as const }],
    take: limit,
    include: { company: { select: { name: true } } },
  });
}

// Only ever used by the public job-detail page — a CLOSED job (today, only
// ever closed by admin moderation removal; see removeFlaggedListing) has no
// other legitimate viewer, so it 404s like a deleted resource rather than
// staying live at its existing/indexed/shared URL.
export async function getJobById(id: string) {
  return prisma.job.findUnique({
    where: { id, ...activeJob },
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
