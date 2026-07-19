import type { Metadata } from "next";
import Link from "next/link";
import { JobsSearchControls } from "@/components/jobs-search-controls";
import { CATEGORIES } from "@/lib/constants";
import { getSeekerState } from "@/lib/data/seeker";
import { listJobs, type JobSort } from "@/lib/data/jobs";
import { applyToJob, toggleSaveJob } from "@/lib/actions/seeker";

export const metadata: Metadata = {
  title: "Find shifts and gig work",
  description: "Browse verified gig and hourly shifts near you — delivery, warehouse, events, home services, and more.",
};

const PAGE_SIZE = 10;

export default async function JobsListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string; sort?: string; page?: string }>;
}) {
  const params = await searchParams;
  const category = params.category ?? "All Categories";
  const search = params.q ?? "";
  const sort = (params.sort as JobSort) ?? "relevant";
  const page = Math.max(1, Number(params.page) || 1);

  const [{ jobs, total }, seekerState] = await Promise.all([
    listJobs({ category, search, sort, page, pageSize: PAGE_SIZE }),
    getSeekerState(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function categoryHref(c: string) {
    const p = new URLSearchParams();
    if (c !== "All Categories") p.set("category", c);
    if (search) p.set("q", search);
    if (sort !== "relevant") p.set("sort", sort);
    return `/jobs${p.toString() ? `?${p.toString()}` : ""}`;
  }

  return (
    <main className="mx-auto grid max-w-5xl grid-cols-1 gap-10 px-8 pt-24 pb-22 sm:grid-cols-[200px_1fr]">
      <aside>
        <div className="mb-4 font-serif text-[15px] text-text-faint italic">Category</div>
        {["All Categories", ...CATEGORIES].map((c) => {
          const active = category === c;
          return (
            <Link
              key={c}
              href={categoryHref(c)}
              className={`mb-0.5 block w-fit py-2 text-left text-sm ${
                active ? "border-b border-accent font-medium text-accent" : "border-b border-transparent text-text-body"
              }`}
            >
              {c}
            </Link>
          );
        })}
      </aside>

      <div>
        <JobsSearchControls />
        <div className="mb-5 font-serif text-[15px] text-text-faint italic">{total} jobs available</div>

        <div className="flex flex-col">
          {jobs.map((job) => {
            const saved = seekerState?.savedJobIds.includes(job.id) ?? false;
            const applied = seekerState?.appliedJobIds.includes(job.id) ?? false;

            return (
              <div key={job.id} className="flex items-start justify-between gap-5 border-t border-text-primary/14 py-6">
                <div>
                  <Link href={`/jobs/${job.id}`} className="mb-1.5 block font-serif text-xl">
                    {job.title}
                  </Link>
                  <div className="mb-3 text-[13.5px] text-text-muted">
                    {job.company.name} · {job.location}
                    {job.distanceMi != null ? ` · ${job.distanceMi} mi` : ""}
                  </div>
                  <div className="flex flex-wrap gap-3.5">
                    <span className="text-[11px] font-medium tracking-wide text-text-body uppercase">{job.shift}</span>
                    {job.urgent && (
                      <span className="text-[11px] font-medium tracking-wide text-warning uppercase">Urgent</span>
                    )}
                    {job.verifiedEmployer && (
                      <span className="text-[11px] font-medium tracking-wide text-success uppercase">✓ Verified</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-3 text-right">
                  <div className="font-serif text-xl whitespace-nowrap">{job.payDisplay}</div>
                  <div className="flex gap-2">
                    <form action={toggleSaveJob.bind(null, job.id)}>
                      <button
                        type="submit"
                        className="rounded-md border border-text-primary/20 bg-white px-3 py-2 text-xs font-medium text-text-body"
                      >
                        {saved ? "✓ Saved" : "+ Save"}
                      </button>
                    </form>
                    <form action={applyToJob.bind(null, job.id)}>
                      <button
                        type="submit"
                        disabled={applied}
                        className={
                          applied
                            ? "rounded-md border border-text-primary/20 bg-[#f0eee7] px-3.5 py-2 text-xs font-medium text-text-muted"
                            : "rounded-md bg-accent px-3.5 py-2 text-xs font-medium text-white"
                        }
                      >
                        {applied ? "Applied ✓" : "Apply Now"}
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            );
          })}
          {jobs.length === 0 && (
            <div className="border-t border-text-primary/14 py-12 text-center text-sm text-text-muted">
              No jobs match your search. Try a different category or keyword.
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-4 text-sm">
            {page > 1 && (
              <Link href={`${categoryHref(category)}${categoryHref(category).includes("?") ? "&" : "?"}page=${page - 1}`}>
                ← Previous
              </Link>
            )}
            <span className="text-text-muted">
              Page {page} of {totalPages}
            </span>
            {page < totalPages && (
              <Link href={`${categoryHref(category)}${categoryHref(category).includes("?") ? "&" : "?"}page=${page + 1}`}>
                Next →
              </Link>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
