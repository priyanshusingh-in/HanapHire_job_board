"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { startAgent, rescreenApplicants } from "@/lib/actions/agent";

const STEP_LABELS = [
  "Reading job criteria & requirements",
  "Scanning applicant profiles",
  "Scoring candidates against criteria",
  "Ranking top matches",
  "Drafting personalized outreach messages",
];

export type RunSnapshot = {
  id: string;
  status: "IDLE" | "RUNNING" | "DONE" | "FAILED";
  currentStep: number;
  error: string | null;
} | null;

export function AgentPanel({
  jobId,
  applicantCount,
  initialRun,
}: {
  jobId: string;
  applicantCount: number;
  initialRun: RunSnapshot;
}) {
  const router = useRouter();
  const [run, setRun] = useState<RunSnapshot>(initialRun);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!run || run.status !== "RUNNING") return;

    const supabase = createClient();
    const channel = supabase
      .channel(`screening-run-${run.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "screening_runs", filter: `id=eq.${run.id}` },
        (payload) => {
          const next = payload.new as {
            id: string;
            status: RunSnapshot extends infer T ? (T extends { status: infer S } ? S : never) : never;
            currentStep: number;
            error: string | null;
          };
          setRun({ id: next.id, status: next.status, currentStep: next.currentStep, error: next.error });
          if (next.status === "DONE" || next.status === "FAILED") {
            router.refresh();
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.id, run?.status]);

  function handleStart() {
    startTransition(async () => {
      const created = await startAgent(jobId);
      setRun({ id: created.id, status: "RUNNING", currentStep: 0, error: null });
    });
  }

  function handleRescreen() {
    startTransition(async () => {
      const created = await rescreenApplicants(jobId);
      setRun({ id: created.id, status: "RUNNING", currentStep: 0, error: null });
    });
  }

  if (!run) {
    return (
      <div className="border border-dashed border-text-primary/28 bg-[#fdfcfa] p-9 text-center">
        <div className="mb-2.5 font-serif text-lg">{applicantCount} applicants ready to screen</div>
        <div className="mb-6 text-sm text-text-muted">
          The agent will read your criteria, score every applicant, rank the top matches, and draft personalized
          outreach — fully in the background.
        </div>
        <button
          type="button"
          onClick={handleStart}
          disabled={isPending}
          className="rounded-md bg-accent px-6.5 py-3.5 text-[15px] font-semibold text-white disabled:opacity-60"
        >
          Start Agent
        </button>
      </div>
    );
  }

  if (run.status === "RUNNING") {
    return (
      <div className="border border-text-primary/14 bg-white p-7.5">
        <div className="mb-6 flex items-center gap-3">
          <div className="h-4.5 w-4.5 animate-spin rounded-full border-[2.5px] border-accent-ai/20 border-t-accent-ai" />
          <div className="font-serif text-lg">Agent running in the background…</div>
        </div>
        <div className="flex flex-col gap-4">
          {STEP_LABELS.map((label, i) => {
            const isDoneStep = i < run.currentStep;
            const isActive = i === run.currentStep;
            return (
              <div key={label} className={`flex items-center gap-3 ${isDoneStep || isActive ? "opacity-100" : "opacity-40"}`}>
                <div
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-medium ${
                    isDoneStep ? "bg-[#e7f7ef] text-success" : "bg-[#f0eee7] text-text-faint"
                  }`}
                >
                  {isDoneStep ? "✓" : ""}
                </div>
                <span className="text-sm text-text-body">{label}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-6 text-xs text-text-faint">
          Feel free to navigate elsewhere — we&apos;ll notify you the moment it&apos;s done.
        </div>
      </div>
    );
  }

  if (run.status === "FAILED") {
    return (
      <div className="border border-danger p-6.5">
        <div className="mb-1 font-serif text-lg text-danger">Screening failed</div>
        <div className="mb-4 text-sm text-text-muted">{run.error ?? "An unexpected error occurred."}</div>
        <button
          type="button"
          onClick={handleStart}
          disabled={isPending}
          className="rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          Try again
        </button>
      </div>
    );
  }

  // DONE — results render server-side below this panel; just offer re-screen.
  return (
    <div className="mb-2 flex justify-end">
      <button
        type="button"
        onClick={handleRescreen}
        disabled={isPending}
        className="rounded-md border border-text-primary/20 bg-white px-4 py-2 text-[13px] font-medium disabled:opacity-60"
      >
        Re-screen Applicants
      </button>
    </div>
  );
}
