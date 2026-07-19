import "server-only";
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
  const distinctSeekers = await prisma.application.findMany({
    where: { job: { category } },
    distinct: ["seekerId"],
    select: { seekerId: true },
  });
  return distinctSeekers.length;
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
export async function getHeroWorkersData(): Promise<Record<string, HeroWorkerData>> {
  const entries = await Promise.all(
    CATEGORIES.map(async (category) => {
      const [count, sample] = await Promise.all([getWorkerCount(category), getWorkerSample(category, 3)]);
      return [category, { count, sample }] as const;
    }),
  );
  return Object.fromEntries(entries);
}

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
