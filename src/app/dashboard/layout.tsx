import { AppShell } from "@/components/app-shell";
import { requireRole } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole(["SEEKER"]);

  return (
    <AppShell
      role="SEEKER"
      name={profile.name}
      profileId={profile.id}
      navItems={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Find Jobs", href: "/jobs" },
      ]}
    >
      {children}
    </AppShell>
  );
}
