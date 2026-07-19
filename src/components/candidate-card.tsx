"use client";

import { useState, useTransition } from "react";
import { approveAndSend, dismissCandidate, editOutreachDraft } from "@/lib/actions/outreach";

export type Candidate = {
  applicationId: string;
  name: string;
  initial: string;
  yearsExp: string;
  availability: string;
  rating: number;
  matchScore: number;
  rationale: string;
  draftMessage: string;
  outreachStatus: "PENDING" | "SENT" | "DISMISSED";
};

export function CandidateCard({ candidate }: { candidate: Candidate }) {
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(candidate.draftMessage);
  const [status, setStatus] = useState(candidate.outreachStatus);

  function handleApprove() {
    startTransition(async () => {
      await approveAndSend(candidate.applicationId);
      setStatus("SENT");
    });
  }

  function handleDismiss() {
    startTransition(async () => {
      await dismissCandidate(candidate.applicationId);
      setStatus("DISMISSED");
    });
  }

  function handleSaveDraft() {
    startTransition(async () => {
      await editOutreachDraft(candidate.applicationId, draft);
      setEditing(false);
    });
  }

  return (
    <div className="border border-text-primary/14 bg-white p-6">
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-3.5">
          <div className="flex h-10.5 w-10.5 items-center justify-center rounded-full bg-[#f0eee7] font-serif text-[15px]">
            {candidate.initial}
          </div>
          <div>
            <div className="font-serif text-lg">{candidate.name}</div>
            <div className="text-[12.5px] text-text-muted">
              {candidate.yearsExp} · {candidate.availability} · ★ {candidate.rating.toFixed(1)}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-serif text-2xl text-accent-ai">{candidate.matchScore}%</div>
          <div className="text-[10.5px] tracking-wide text-text-faint uppercase">match score</div>
        </div>
      </div>

      <div className="mb-3.5 border-l-2 border-accent-ai bg-[#fdfcfa] px-4 py-3.5 text-[14.5px] leading-relaxed text-text-body">
        {candidate.rationale}
      </div>

      <div className="mb-2 text-[11.5px] tracking-wide text-text-faint uppercase">Drafted outreach</div>
      {editing ? (
        <div className="mb-4">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={400}
            rows={4}
            aria-label={`Edit drafted outreach message to ${candidate.name}`}
            className="input mb-2 resize-y"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={isPending}
              className="rounded-md bg-accent px-4 py-2 text-[13px] font-medium text-white disabled:opacity-60"
            >
              Save draft
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(candidate.draftMessage);
                setEditing(false);
              }}
              className="rounded-md border border-text-primary/20 bg-white px-4 py-2 text-[13px] font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-4 border border-text-primary/14 px-4 py-3.5 text-[14.5px] leading-relaxed text-text-body">
          {draft}
        </div>
      )}

      {status === "PENDING" && !editing && (
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={handleApprove}
            disabled={isPending}
            className="rounded-md bg-accent px-4 py-2.5 text-[13px] font-medium text-white disabled:opacity-60"
          >
            Approve &amp; send
          </button>
          <button
            type="button"
            onClick={() => setEditing(true)}
            disabled={isPending}
            className="rounded-md border border-text-primary/20 bg-white px-4 py-2.5 text-[13px] font-medium disabled:opacity-60"
          >
            Edit draft
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            disabled={isPending}
            className="rounded-md border border-text-primary/20 bg-white px-4 py-2.5 text-[13px] font-medium text-danger disabled:opacity-60"
          >
            Dismiss
          </button>
        </div>
      )}
      {status === "SENT" && <span className="text-[13px] font-medium text-success-text">✓ Outreach sent</span>}
      {status === "DISMISSED" && <span className="text-[13px] font-medium text-text-faint">Dismissed</span>}
    </div>
  );
}
