import { getFlaggedListings } from "@/lib/data/admin";
import { removeFlaggedListing } from "@/lib/actions/admin";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";

const SEVERITY_STYLE: Record<string, string> = {
  HIGH: "text-danger",
  MEDIUM: "text-warning-text",
  LOW: "text-text-faint",
};

function relativeTime(date: Date) {
  const ms = Date.now() - date.getTime();
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default async function AdminModerationPage() {
  const flagged = await getFlaggedListings();

  return (
    <div>
      <h1 className="mb-6 font-serif text-[28px] font-medium tracking-tight">Admin console</h1>
      <div className="flex flex-col">
        {flagged.map((f) => (
          <div key={f.id} className="flex items-center justify-between border-t border-text-primary/12 py-4.5">
            <div>
              <div className="mb-0.5 font-serif text-base">{f.job.title}</div>
              <div className="text-[12.5px] text-text-muted">
                {f.job.company.name} · reported {relativeTime(f.reportedAt)}
              </div>
            </div>
            <div className="flex items-center gap-3.5">
              <span className={`text-xs font-medium ${SEVERITY_STYLE[f.severity]}`}>{f.reason}</span>
              <form action={removeFlaggedListing.bind(null, f.id)}>
                <ConfirmSubmitButton
                  confirmMessage={`Remove "${f.job.title}"? This closes the listing and can't be undone from here.`}
                  className="rounded-md bg-danger px-3.5 py-2 text-xs font-medium text-white"
                >
                  <span aria-hidden="true">Remove</span>
                  <span className="sr-only">Remove {f.job.title}</span>
                </ConfirmSubmitButton>
              </form>
            </div>
          </div>
        ))}
        {flagged.length === 0 && (
          <div className="border-t border-text-primary/12 py-10 text-center text-sm text-text-muted">
            No flagged listings — the queue is clear.
          </div>
        )}
      </div>
    </div>
  );
}
