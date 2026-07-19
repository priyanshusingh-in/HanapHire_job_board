import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompanyBySlug } from "@/lib/data/companies";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) return {};

  const description = company.about.slice(0, 155);
  return {
    title: company.name,
    description,
    openGraph: { title: company.name, description },
  };
}

export default async function CompanyProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();

  return (
    <main className="mx-auto max-w-4xl px-8 pb-22">
      <div
        className="-mx-8 h-58"
        style={{
          background:
            "repeating-linear-gradient(135deg, #eceae3, #eceae3 14px, #e2e0d7 14px, #e2e0d7 28px)",
        }}
      />
      <div className="mt-9 flex items-end gap-5 px-2">
        <div className="flex h-23 w-23 items-center justify-center border border-text-primary/18 bg-paper font-serif text-4xl text-accent">
          {company.name[0]}
        </div>
        <div className="pb-2">
          <h1 className="mb-1 font-serif text-3xl tracking-tight">{company.name}</h1>
          <div className="text-[13.5px] text-text-muted">
            {company.industry} · {company.hq}
          </div>
        </div>
      </div>

      <div className="mt-9 grid grid-cols-1 gap-10 sm:grid-cols-[1fr_260px]">
        <div>
          <h2 className="mb-3 font-serif text-xl">About</h2>
          <p className="mb-8.5 text-base leading-relaxed text-text-body">{company.about}</p>

          <h2 className="mb-3.5 font-serif text-xl">Open roles</h2>
          <div className="flex flex-col">
            {company.jobs.map((job) => (
              <Link
                key={job.id}
                href={`/jobs/${job.id}`}
                className="flex items-center justify-between border-t border-text-primary/14 py-4"
              >
                <div>
                  <div className="mb-0.5 font-serif text-lg">{job.title}</div>
                  <div className="text-[12.5px] text-text-muted">{job.location}</div>
                </div>
                <div className="font-serif text-lg">{job.payDisplay}</div>
              </Link>
            ))}
            {company.jobs.length === 0 && (
              <div className="border-t border-text-primary/14 py-6 text-sm text-text-muted">
                No open roles right now.
              </div>
            )}
          </div>
        </div>

        <div className="h-fit border border-text-primary/14 bg-white p-5.5">
          <Row label="Founded" value={company.founded} />
          <Row label="Company size" value={company.size} />
          <Row label="Rating" value={`★ ${company.rating.toFixed(1)} (${company.reviewCount})`} last />
        </div>
      </div>
    </main>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={`flex justify-between ${last ? "" : "mb-3.5 border-b border-text-primary/10 pb-3.5"}`}>
      <span className="text-[13px] text-text-muted">{label}</span>
      <span className="font-serif text-sm">{value}</span>
    </div>
  );
}
