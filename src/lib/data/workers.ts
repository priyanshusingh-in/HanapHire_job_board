import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { CATEGORIES } from "@/lib/constants";

/**
 * "Workers available in <category>" is derived from real applications —
 * distinct seekers who've applied to a job in that category — rather than a
 * fabricated per-category skill directory, since the schema has no direct
 * seeker-to-category field.
 */
async function seekersForCategory(category: string | null, take: number) {
  const applications = await prisma.application.findMany({
    where: category ? { job: { category } } : {},
    distinct: ["seekerId"],
    take,
    orderBy: { appliedAt: "desc" },
    include: {
      seeker: { include: { user: { select: { name: true } } } },
    },
  });
  return applications.map((a) => a.seeker);
}

export async function getWorkerSample(category: string | null, limit = 3) {
  const seekers = await seekersForCategory(category, limit);
  return seekers.map((s) => ({
    initial: initials(s.user.name),
    name: s.user.name,
    rating: s.rating,
    years: yearsLabel(s.yearsExperience),
  }));
}

export async function getWorkerCount(category: string | null) {
  if (!category) {
    return prisma.seekerProfile.count();
  }
  // A true COUNT DISTINCT instead of fetching every matching application
  // row just to read `.length` — the same count, without transferring/
  // materializing the whole row set for what's ultimately a single number.
  const result = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(DISTINCT a."seekerId") AS count
    FROM applications a
    JOIN jobs j ON j.id = a."jobId"
    WHERE j.category = ${category}
  `;
  return Number(result[0]?.count ?? 0);
}

export async function getWorkerCountsByCategory() {
  const counts = await Promise.all(
    CATEGORIES.map(async (category) => [category, await getWorkerCount(category)] as const),
  );
  return Object.fromEntries(counts);
}

export type HeroWorkerData = {
  count: number;
  sample: Awaited<ReturnType<typeof getWorkerSample>>;
};

/** Per-category worker count + sample for the hero widget's "Hiring" mode, prefetched once for client-side filtering. */
async function loadHeroWorkersData(): Promise<Record<string, HeroWorkerData>> {
  const entries = await Promise.all(
    CATEGORIES.map(async (category) => {
      const [count, sample] = await Promise.all([getWorkerCount(category), getWorkerSample(category, 3)]);
      return [category, { count, sample }] as const;
    }),
  );
  return Object.fromEntries(entries);
}

// The landing page renders per-request (force-dynamic — see its own
// comment for why), so without this cache these ~12 queries would re-run
// on every single homepage visit instead of the ~once/minute they cost
// under the ISR setup this replaced.
export const getHeroWorkersData = unstable_cache(loadHeroWorkersData, ["hero-workers-data"], {
  revalidate: 60,
});

function initials(name: string) {
  return (
    name
      .split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

function yearsLabel(yearsExperience: unknown) {
  if (yearsExperience && typeof yearsExperience === "object") {
    const values = Object.values(yearsExperience as Record<string, string>);
    if (values[0]) return values[0];
  }
  return "Experienced";
}
