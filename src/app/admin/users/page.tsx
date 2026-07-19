import { getRecentUsers } from "@/lib/data/admin";
import { setUserSuspended } from "@/lib/actions/admin";

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

export default async function AdminUsersPage() {
  const users = await getRecentUsers();

  return (
    <div>
      <h1 className="mb-6 font-serif text-[28px] font-medium tracking-tight">Admin console</h1>
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
              {u.role !== "ADMIN" && (
                <form action={setUserSuspended.bind(null, u.id, !u.suspended)}>
                  <button
                    type="submit"
                    className="rounded-md border border-text-primary/20 bg-white px-3.5 py-1.5 text-xs font-medium"
                  >
                    {u.suspended ? "Reactivate" : "Suspend"}
                  </button>
                </form>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
