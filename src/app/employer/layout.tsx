import { AppShell } from "@/components/app-shell";
import { requireRole } from "@/lib/auth";

export default async function EmployerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole(["EMPLOYER"]);

  return (
    <AppShell
      role="EMPLOYER"
      name={profile.name}
      navItems={[
        { label: "Dashboard", href: "/employer" },
        { label: "Post a Job", href: "/employer/jobs/new" },
        { label: "AI Screening Agent", href: "/employer/agent" },
      ]}
    >
      {children}
    </AppShell>
  );
}
