import { getRecentUsers } from "@/lib/data/admin";
import { setUserSuspended } from "@/lib/actions/admin";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";

const ROLE_LABEL: Record<string, string> = {
  SEEKER: "Job Seeker",
  EMPLOYER: "Employer",
  ADMIN: "Admin",
};

function relativeTime(date: Date) {
  const ms = Date.now() - date.getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days < 1) return "today";
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const users = await getRecentUsers(q);

  return (
    <div>
      <h1 className="mb-6 font-serif text-[28px] font-medium tracking-tight">Admin console</h1>

      <form className="mb-5" action="/admin/users">
        <label htmlFor="user-search" className="sr-only">
          Search users by name or email
        </label>
        <input
          id="user-search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by name or email…"
          className="input max-w-sm"
        />
      </form>

      <div className="flex flex-col">
        {users.map((u) => (
          <div key={u.id} className="flex items-center justify-between border-t border-text-primary/12 py-4">
            <div>
              <div className="font-serif text-[15.5px]">{u.name}</div>
              <div className="text-xs text-text-muted">
                {ROLE_LABEL[u.role]} · joined {relativeTime(u.createdAt)}
              </div>
            </div>
            <div className="flex items-center gap-3.5">
              <span className={`text-xs font-medium ${u.suspended ? "text-danger" : "text-success-text"}`}>
                {u.suspended ? "Suspended" : "Active"}
              </span>
              {u.role !== "ADMIN" &&
                (u.suspended ? (
                  <form action={setUserSuspended.bind(null, u.id, false)}>
                    <button
                      type="submit"
                      aria-label={`Reactivate ${u.name}`}
                      className="rounded-md border border-success px-3.5 py-1.5 text-xs font-medium text-success-text"
                    >
                      Reactivate
                    </button>
                  </form>
                ) : (
                  <form action={setUserSuspended.bind(null, u.id, true)}>
                    <ConfirmSubmitButton
                      confirmMessage={`Suspend ${u.name}? They'll immediately lose access until reactivated.`}
                      className="rounded-md border border-danger px-3.5 py-1.5 text-xs font-medium text-danger"
                    >
                      Suspend
                    </ConfirmSubmitButton>
                  </form>
                ))}
            </div>
          </div>
        ))}
        {users.length === 0 && (
          <div className="border-t border-text-primary/12 py-12 text-center text-sm text-text-muted">
            No users match your search.
          </div>
        )}
      </div>
    </div>
  );
}
