"use client";

import Link from "next/link";
import { useState } from "react";
import { CATEGORIES } from "@/lib/constants";

type HeroJob = {
  id: string;
  title: string;
  category: string;
  location: string;
  payDisplay: string;
  company: { name: string };
};

type WorkerData = { count: number; sample: { initial: string; name: string; rating: number; years: string }[] };

export function HeroWidget({
  jobs,
  workersByCategory,
  totalWorkerCount,
}: {
  jobs: HeroJob[];
  workersByCategory: Record<string, WorkerData>;
  totalWorkerCount: number;
}) {
  const [mode, setMode] = useState<"seeker" | "employer">("seeker");
  const [category, setCategory] = useState<string | null>(null);

  const isSeeker = mode === "seeker";
  const matches = (category ? jobs.filter((j) => j.category === category) : jobs).slice(0, 3);
  const totalInCategory = category ? jobs.filter((j) => j.category === category).length : jobs.length;
  const seeAllLabel = category ? `See all ${totalInCategory} ${category} jobs →` : "Browse all jobs →";
  const seeAllHref = category ? `/jobs?category=${encodeURIComponent(category)}` : "/jobs";

  const workerData = category ? workersByCategory[category] : undefined;
  const workerCount = workerData ? workerData.count : totalWorkerCount;
  const workerCountLabel = `${workerCount.toLocaleString()} workers available${category ? ` in ${category}` : " near you"}`;
  const workerSample = workerData?.sample.length
    ? workerData.sample
    : Object.values(workersByCategory)
        .flatMap((w) => w.sample)
        .slice(0, 3);
  const postJobLabel = category ? `Post a ${category} job →` : "Post a job free →";

  return (
    <section className="mx-auto max-w-4xl px-8 pt-6">
      <div className="relative z-10 -mt-16 border border-text-primary/14 bg-[#fdfcfa] px-10 py-9 shadow-[0_24px_60px_rgba(21,19,15,0.12)]">
        <div className="mb-5.5 flex justify-center">
          <div className="inline-flex rounded-full border border-text-primary/16 p-1">
            <button
              type="button"
              onClick={() => setMode("seeker")}
              className={`rounded-full px-5 py-2 text-[13.5px] whitespace-nowrap ${
                isSeeker ? "bg-accent font-semibold text-white" : "text-text-muted"
              }`}
            >
              Looking for work
            </button>
            <button
              type="button"
              onClick={() => setMode("employer")}
              className={`rounded-full px-5 py-2 text-[13.5px] whitespace-nowrap ${
                !isSeeker ? "bg-accent-ai font-semibold text-white" : "text-text-muted"
              }`}
            >
              Hiring
            </button>
          </div>
        </div>

        <div className="mb-4.5 text-center font-serif text-lg text-text-muted italic">
          {isSeeker ? "What kind of work are you looking for?" : "What kind of talent are you hiring?"}
        </div>

        <div className="mb-7 flex flex-wrap justify-center gap-2.5">
          {CATEGORIES.map((c) => {
            const active = category === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(active ? null : c)}
                className={`rounded-full border px-4 py-2 text-[13px] font-medium ${
                  active ? "border-accent bg-accent text-white" : "border-text-primary/20 text-text-body"
                }`}
              >
                {c}
              </button>
            );
          })}
        </div>

        {isSeeker ? (
          <>
            <div
              className="grid gap-px border border-text-primary/10 bg-text-primary/10"
              style={{ gridTemplateColumns: `repeat(${Math.max(matches.length, 1)}, 1fr)` }}
            >
              {matches.map((job) => (
                <Link key={job.id} href={`/jobs/${job.id}`} className="bg-white p-4.5">
                  <div className="mb-1 font-serif text-[15.5px]">{job.title}</div>
                  <div className="mb-2.5 text-[12.5px] text-text-muted">
                    {job.company.name} · {job.location}
                  </div>
                  <div className="font-serif text-[17px]">{job.payDisplay}</div>
                </Link>
              ))}
              {matches.length === 0 && (
                <div className="bg-white p-6 text-center text-sm text-text-muted">
                  No open roles in this category right now.
                </div>
              )}
            </div>
            <div className="mt-5.5 text-center">
              <Link href={seeAllHref} className="rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-white">
                {seeAllLabel}
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="mb-4.5 text-center text-[15px] font-medium text-text-body">{workerCountLabel}</div>
            <div
              className="grid gap-px border border-text-primary/10 bg-text-primary/10"
              style={{ gridTemplateColumns: `repeat(${Math.max(workerSample.length, 1)}, 1fr)` }}
            >
              {workerSample.map((w, i) => (
                <div key={i} className="bg-white p-4.5 text-center">
                  <div className="mx-auto mb-2.5 flex h-[42px] w-[42px] items-center justify-center rounded-full bg-[#f0eee7] font-serif text-sm">
                    {w.initial}
                  </div>
                  <div className="mb-0.5 font-serif text-[15px]">{w.name}</div>
                  <div className="text-xs text-text-muted">
                    {w.years} · ★ {w.rating.toFixed(1)}
                  </div>
                </div>
              ))}
              {workerSample.length === 0 && (
                <div className="bg-white p-6 text-center text-sm text-text-muted">No workers matched yet.</div>
              )}
            </div>
            <div className="mt-5.5 text-center">
              <Link href="/signup?role=employer" className="rounded-md bg-accent-ai px-5 py-2.5 text-sm font-semibold text-white">
                {postJobLabel}
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
