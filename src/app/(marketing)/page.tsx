import Image from "next/image";
import Link from "next/link";
import { HeroWidget } from "@/components/hero-widget";
import { getFeaturedJobs, getJobsByCategory } from "@/lib/data/jobs";
import { getHeroWorkersData } from "@/lib/data/workers";
import { prisma } from "@/lib/prisma";

export const revalidate = 60;

const HOW_IT_WORKS = [
  { num: "01", title: "Browse & apply", body: "Search shifts by pay, distance, and schedule — apply in one tap." },
  { num: "02", title: "Get matched fast", body: "Verified employers respond in minutes, not days." },
  { num: "03", title: "Get paid weekly", body: "Track hours and get paid on a reliable weekly schedule." },
];

export default async function LandingPage() {
  const [heroJobs, featuredJobs, workersByCategory, totalWorkerCount] = await Promise.all([
    getJobsByCategory(null, 100),
    getFeaturedJobs(3),
    getHeroWorkersData(),
    prisma.seekerProfile.count(),
  ]);

  return (
    <>
      <section className="bg-ink">
        <div className="mx-auto max-w-3xl px-6 pt-20 pb-20 text-center sm:px-8 sm:pt-30 sm:pb-30">
          <div className="mb-6.5 font-serif text-lg text-accent italic">On-demand hiring, made instant</div>
          <h1 className="mb-6.5 font-serif text-6xl leading-[1.1] font-medium tracking-tight text-cream sm:text-7xl">
            Get hired today.
            <br />
            <span className="italic">Hire in minutes.</span>
          </h1>
          <p className="mx-auto mb-10 max-w-lg text-lg leading-relaxed text-cream/68">
            HanapHire connects gig and hourly workers with businesses that need them right now — same-day shifts,
            verified profiles, and instant applications.
          </p>
          <div className="mb-15 flex flex-wrap justify-center gap-3.5">
            <Link href="/jobs" className="rounded-md bg-accent px-6.5 py-3.5 text-[15px] font-semibold text-white">
              Find work near you
            </Link>
            <Link
              href="/signup?role=employer"
              className="rounded-md border border-cream/28 px-6.5 py-3.5 text-[15px] font-semibold text-cream"
            >
              Post a job free
            </Link>
          </div>
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-5 border-t border-cream/14 pt-9 sm:gap-x-14">
            {[
              { label: "Gig workers", value: "50K+" },
              { label: "Employers", value: "12K+" },
              { label: "Avg. rating", value: "4.8" },
              { label: "Avg. time to hire", value: "35 min" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="font-serif text-[28px] text-cream">{stat.value}</div>
                <div className="mt-1 text-xs text-cream/55">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <HeroWidget
        jobs={heroJobs.map((job) => ({
          id: job.id,
          title: job.title,
          category: job.category,
          location: job.location,
          payDisplay: job.payDisplay,
          company: { name: job.company.name },
        }))}
        workersByCategory={workersByCategory}
        totalWorkerCount={totalWorkerCount}
      />

      <section className="mx-auto max-w-3xl px-8 pt-26 pb-22">
        <h2 className="mb-10 font-serif text-[34px] font-medium tracking-tight">How it works</h2>
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-3">
          {HOW_IT_WORKS.map((step) => (
            <div key={step.num}>
              <div className="mb-3.5 font-serif text-accent-hover italic">{step.num}</div>
              <div className="mb-2.5 font-serif text-lg">{step.title}</div>
              <div className="text-sm leading-relaxed text-text-muted">{step.body}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-8 pb-24">
        <div className="mb-8 flex items-baseline justify-between">
          <h2 className="font-serif text-[34px] font-medium tracking-tight">Featured jobs</h2>
          <Link href="/jobs" className="font-serif text-base italic">
            Browse all →
          </Link>
        </div>
        <div className="flex flex-col">
          {featuredJobs.map((job) => (
            <Link
              key={job.id}
              href={`/jobs/${job.id}`}
              className="flex items-center justify-between gap-5 border-t border-text-primary/14 py-6.5"
            >
              <div>
                <div className="mb-1.5 flex items-center gap-2.5">
                  <div className="font-serif text-lg">{job.title}</div>
                  {job.urgent && (
                    <span className="border-b border-warning pb-0.5 text-[11px] font-medium tracking-wide text-warning-text uppercase">
                      Urgent
                    </span>
                  )}
                </div>
                <div className="text-[13.5px] text-text-muted">
                  {job.company.name} · {job.location} · {job.shift}
                </div>
              </div>
              <div className="font-serif text-xl whitespace-nowrap">{job.payDisplay}</div>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-ink px-8 py-22">
        <div className="mx-auto grid max-w-3xl grid-cols-1 gap-14 sm:grid-cols-2">
          <div>
            <div className="mb-5 font-serif text-xl leading-relaxed text-[#e5e3dd] italic">
              &ldquo;I picked up a shift the same afternoon I applied. No waiting around for a callback — I just
              showed up and got paid.&rdquo;
            </div>
            <div className="text-sm font-medium text-cream">Marisol Tan</div>
            <div className="mt-0.5 text-[13px] text-text-faint">Event Setup Crew, Denver</div>
          </div>
          <div>
            <div className="mb-5 font-serif text-xl leading-relaxed text-[#e5e3dd] italic">
              &ldquo;We filled an overnight warehouse shift in under an hour. The AI screening cut our review time
              from days to minutes.&rdquo;
            </div>
            <div className="text-sm font-medium text-cream">Owen Marsh</div>
            <div className="mt-0.5 text-[13px] text-text-faint">Ops Manager, Fulcrum Distribution</div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-3xl grid-cols-1 items-center gap-12 px-8 py-24 sm:grid-cols-2">
        <div>
          <div className="mb-5 font-serif text-accent-ai italic">AI Screening Agent</div>
          <h2 className="mb-4.5 font-serif text-[32px] leading-[1.2] font-medium tracking-tight">
            Hiring, without
            <br />
            the backlog.
          </h2>
          <p className="mb-6.5 max-w-sm text-base leading-relaxed text-text-muted">
            Post a job and our screening agent works in the background — reading your requirements, ranking every
            applicant, and drafting outreach to your top matches so you can hire in minutes, not days.
          </p>
          <Link href="/signup?role=employer" className="rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-white">
            See it in action
          </Link>
        </div>
        <div className="aspect-4/3 overflow-hidden border border-text-primary/14 shadow-[0_20px_50px_rgba(21,19,15,0.1)]">
          <Image
            src="/ai-agent-screenshot.png"
            alt="AI Screening Agent ranking view"
            width={800}
            height={600}
            className="h-full w-full object-cover object-top"
          />
        </div>
      </section>
    </>
  );
}
