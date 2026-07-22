import { getAdminStats } from "@/lib/data/admin";

export default async function AdminOverviewPage() {
  const stats = await getAdminStats();

  return (
    <div>
      <h1 className="mb-6 font-serif text-[28px] font-medium tracking-tight">Admin console</h1>
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="border-t border-text-primary/14 py-5">
            <div className="mb-1.5 font-serif text-[30px]">{stat.value}</div>
            <div className="text-[12.5px] text-text-muted">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
