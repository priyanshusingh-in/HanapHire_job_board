import type { Metadata } from "next";
import Link from "next/link";
import { listCompanies } from "@/lib/data/companies";

export const metadata: Metadata = {
  title: "Company directory",
  description: "Browse verified employers hiring on HanapHire.",
};

// See the landing page (src/app/(marketing)/page.tsx) for why this is
// force-dynamic instead of ISR — same build-time-DB-access problem.
export const dynamic = "force-dynamic";

export default async function CompaniesPage() {
  const companies = await listCompanies();

  return (
    <main className="mx-auto max-w-3xl px-8 pt-24 pb-22">
      <h1 className="mb-8 font-serif text-4xl tracking-tight">Company directory</h1>
      <div className="flex flex-col">
        {companies.map((company) => (
          <Link
            key={company.id}
            href={`/companies/${company.slug}`}
            className="flex items-center justify-between gap-5 border-t border-text-primary/14 py-5"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 items-center justify-center border border-text-primary/18 font-serif text-lg text-accent">
                {company.name[0]}
              </div>
              <div>
                <div className="font-serif text-lg">{company.name}</div>
                <div className="text-[13px] text-text-muted">
                  {company.industry} · {company.hq}
                </div>
              </div>
            </div>
            <div className="text-right text-[13px] text-text-muted">
              <div>★ {company.rating.toFixed(1)}</div>
              <div>
                {company._count.jobs} open {company._count.jobs === 1 ? "role" : "roles"}
              </div>
            </div>
          </Link>
        ))}
        {companies.length === 0 && (
          <div className="border-t border-text-primary/14 py-12 text-center text-sm text-text-muted">
            No companies listed yet.
          </div>
        )}
      </div>
    </main>
  );
}
