import "server-only";
import { prisma } from "@/lib/prisma";

export async function getCompanyBySlug(slug: string) {
  const company = await prisma.company.findUnique({
    where: { slug },
    include: {
      jobs: {
        where: { status: "ACTIVE" },
        orderBy: { postedAt: "desc" },
      },
    },
  });
  return company;
}

export async function listCompanies() {
  return prisma.company.findMany({
    orderBy: { rating: "desc" },
    include: { _count: { select: { jobs: { where: { status: "ACTIVE" } } } } },
  });
}
