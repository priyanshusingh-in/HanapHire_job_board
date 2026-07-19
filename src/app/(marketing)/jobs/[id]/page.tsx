import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { applyToJob, toggleSaveJob } from "@/lib/actions/seeker";
import { getSeekerState } from "@/lib/data/seeker";
import { getJobById, getSimilarJobs } from "@/lib/data/jobs";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const job = await getJobById(id);
  if (!job) return {};

  return {
    title: `${job.title} at ${job.company.name}`,
    description: job.description.slice(0, 155),
    openGraph: {
      title: `${job.title} at ${job.company.name}`,
      description: job.description.slice(0, 155),
    },
  };
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const job = await getJobById(id);
  if (!job) notFound();

  const [similarJobs, seekerState] = await Promise.all([
    getSimilarJobs(job.category, job.id, 3),
    getSeekerState(),
  ]);

  const saved = seekerState?.savedJobIds.includes(job.id) ?? false;
  const applied = seekerState?.appliedJobIds.includes(job.id) ?? false;
  const postedAgo = relativeTime(job.postedAt);

  return (
    <main className="mx-auto grid max-w-4xl grid-cols-1 gap-10 px-8 pt-24 pb-22 sm:grid-cols-[1fr_280px]">
      <div>
        <Link href="/jobs" className="text-[13.5px] text-text-muted">
          ← Back to listings
        </Link>
        <h1 className="mt-5.5 mb-2 font-serif text-4xl tracking-tight">{job.title}</h1>
        <Link href={`/companies/${job.company.slug}`} className="mb-5 block font-serif text-lg text-accent italic">
          {job.company.name}
        </Link>
        <div className="mb-8 flex flex-wrap gap-4">
          <span className="text-xs font-medium tracking-wide text-text-muted uppercase">{job.location}</span>
          <span className="text-xs font-medium tracking-wide text-text-muted uppercase">{job.shift}</span>
          <span className="text-xs font-medium tracking-wide text-text-muted uppercase">Posted {postedAgo}</span>
        </div>

        <h2 className="mb-3 font-serif text-xl">About this role</h2>
        <p className="mb-7.5 text-base leading-relaxed text-text-body">{job.description}</p>

        <h2 className="mb-3 font-serif text-xl">Requirements</h2>
        <ul className="mb-7.5 list-disc pl-5 text-[15.5px] leading-loose text-text-body">
          {job.requirements.map((req) => (
            <li key={req}>{req}</li>
          ))}
        </ul>

        <h2 className="mb-3 font-serif text-xl">Pay & schedule</h2>
        <p className="text-base leading-relaxed text-text-body">{job.payDetails}</p>
      </div>

      <aside>
        <div className="sticky top-24 border border-text-primary/14 bg-white p-7">
          <div className="mb-1 font-serif text-[30px]">{job.payDisplay}</div>
          <div className="mb-6 text-[13.5px] text-text-muted">{job._count.applications} people applied</div>

          <form action={applyToJob.bind(null, job.id)}>
            <button
              type="submit"
              disabled={applied}
              className={
                applied
                  ? "w-full rounded-md bg-[#f0eee7] py-3.5 text-[15px] font-semibold text-text-muted"
                  : "w-full rounded-md bg-accent py-3.5 text-[15px] font-semibold text-white"
              }
            >
              {applied ? "Applied ✓" : "Apply now"}
            </button>
          </form>
          <form action={toggleSaveJob.bind(null, job.id)} className="mt-2.5">
            <button type="submit" className="w-full rounded-md border border-text-primary/20 bg-white py-3 text-sm font-medium">
              {saved ? "✓ Saved" : "+ Save for later"}
            </button>
          </form>

          <div className="mt-6 border-t border-text-primary/12 pt-6 text-[13.5px] text-text-muted">
            ★ {job.company.rating.toFixed(1)} employer rating
          </div>
        </div>

        {similarJobs.length > 0 && (
          <div className="mt-7">
            <div className="mb-3.5 font-serif text-[15px] text-text-faint italic">Similar jobs</div>
            {similarJobs.map((sj) => (
              <Link key={sj.id} href={`/jobs/${sj.id}`} className="block border-t border-text-primary/14 py-3.5">
                <div className="mb-0.5 font-serif text-[15px]">{sj.title}</div>
                <div className="text-[12.5px] text-text-muted">
                  {sj.company.name} · {sj.payDisplay}
                </div>
              </Link>
            ))}
          </div>
        )}
      </aside>
    </main>
  );
}

function relativeTime(date: Date) {
  const ms = Date.now() - date.getTime();
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
