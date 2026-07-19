import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const [jobs, companies] = await Promise.all([
    prisma.job.findMany({ where: { status: "ACTIVE" }, select: { id: true, postedAt: true } }),
    prisma.company.findMany({ select: { slug: true } }),
  ]);

  return [
    { url: site, changeFrequency: "daily", priority: 1 },
    { url: `${site}/jobs`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${site}/companies`, changeFrequency: "daily", priority: 0.6 },
    { url: `${site}/login`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${site}/signup`, changeFrequency: "yearly", priority: 0.3 },
    ...jobs.map((job) => ({
      url: `${site}/jobs/${job.id}`,
      lastModified: job.postedAt,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    ...companies.map((company) => ({
      url: `${site}/companies/${company.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
  ];
}
