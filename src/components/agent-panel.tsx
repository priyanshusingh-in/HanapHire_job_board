"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { startAgent, rescreenApplicants } from "@/lib/actions/agent";
import { STALE_RUN_MS } from "@/lib/agent-constants";

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
  startedAt: string | null;
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
  const [showRetry, setShowRetry] = useState(false);

  useEffect(() => {
    if (!run || run.status !== "RUNNING") return;
    // Aligned to the server's actual stale threshold (STALE_RUN_MS from
    // startAgent) via the run's real startedAt, rather than a flat delay
    // from whenever this component happened to mount. A flat mount-relative
    // timer meant revisiting an already-stuck run's page (e.g. after
    // navigating away and back) restarted the countdown from zero, even if
    // the run was already well past the point the server would actually
    // reset it — so the retry option could take up to another full delay
    // to reappear instead of showing right away.
    const startedAt = run.startedAt ? new Date(run.startedAt).getTime() : Date.now();
    const remaining = Math.max(0, STALE_RUN_MS - (Date.now() - startedAt));
    const timer = setTimeout(() => setShowRetry(true), remaining);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.id, run?.status]);

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
            startedAt: string | null;
          };
          setRun({ id: next.id, status: next.status, currentStep: next.currentStep, error: next.error, startedAt: next.startedAt });
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
      setShowRetry(false);
      setRun({
        id: created.id,
        status: created.status,
        currentStep: created.currentStep,
        error: created.error,
        startedAt: created.startedAt?.toISOString() ?? null,
      });
    });
  }

  function handleRescreen() {
    startTransition(async () => {
      const created = await rescreenApplicants(jobId);
      setShowRetry(false);
      setRun({
        id: created.id,
        status: created.status,
        currentStep: created.currentStep,
        error: created.error,
        startedAt: created.startedAt?.toISOString() ?? null,
      });
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
                    isDoneStep ? "bg-[#e7f7ef] text-success-text" : "bg-[#f0eee7] text-text-faint"
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
        {showRetry && (
          <div className="mt-4 border-t border-text-primary/12 pt-4">
            <div className="mb-2 text-xs text-text-muted">Taking longer than expected?</div>
            <button
              type="button"
              onClick={handleRescreen}
              disabled={isPending}
              className="rounded-md border border-text-primary/20 bg-white px-4 py-2 text-[13px] font-medium disabled:opacity-60"
            >
              Retry
            </button>
          </div>
        )}
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

  if (run.status === "DONE") {
    // Results render server-side below this panel; just offer re-screen.
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

  // IDLE — the schema default, but startAgent() always creates runs as
  // RUNNING, so this is unreachable in practice today. Guarded explicitly
  // rather than falling through to the DONE branch above (which would
  // offer "Re-screen Applicants" for a run that was never actually
  // started) so a future code path that does create an IDLE row doesn't
  // silently misrender.
  return (
    <div className="border border-dashed border-text-primary/28 bg-[#fdfcfa] p-9 text-center">
      <div className="mb-2.5 font-serif text-lg">{applicantCount} applicants ready to screen</div>
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
