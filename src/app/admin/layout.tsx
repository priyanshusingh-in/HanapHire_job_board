import { AppShell } from "@/components/app-shell";
import { requireRole } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole(["ADMIN"]);

  return (
    <AppShell
      role="ADMIN"
      name={profile.name}
      navItems={[
        { label: "Overview", href: "/admin" },
        { label: "Moderation Queue", href: "/admin/moderation" },
        { label: "Users", href: "/admin/users" },
      ]}
    >
      {children}
    </AppShell>
  );
}
