import Image from "next/image";
import Link from "next/link";
import { NavItem, Sidebar } from "@/components/sidebar";
import { NotificationBell } from "@/components/notification-bell";
import { MobileNavProvider } from "@/components/mobile-nav-context";
import { MobileNavToggle } from "@/components/mobile-nav-toggle";
import { getRecentNotifications } from "@/lib/data/notifications";

const ROLE_LABEL: Record<string, string> = {
  SEEKER: "Job Seeker Account",
  EMPLOYER: "Employer Account",
  ADMIN: "Admin Console",
};

export async function AppShell({
  role,
  name,
  profileId,
  navItems,
  children,
}: {
  role: "SEEKER" | "EMPLOYER" | "ADMIN";
  name: string;
  profileId: string;
  navItems: NavItem[];
  children: React.ReactNode;
}) {
  const notifications = await getRecentNotifications(profileId);
  const initials =
    name
      .split(" ")
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  return (
    <MobileNavProvider>
      <div className="min-h-screen">
        <div className="flex items-center justify-between border-b border-text-primary/12 bg-paper px-4 py-4 sm:px-7">
          <div className="flex items-center gap-3">
            <MobileNavToggle />
            <Link href="/">
              <Image src="/logo.png" alt="HanapHire" width={140} height={34} className="h-[28px] w-auto sm:h-[34px]" />
            </Link>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <span className="hidden text-xs tracking-wide text-text-muted uppercase sm:inline">
              {ROLE_LABEL[role]}
            </span>
            <NotificationBell
              initialNotifications={notifications.map((n) => ({
                id: n.id,
                title: n.title,
                body: n.body,
                read: n.read,
                createdAt: n.createdAt.toISOString(),
                relatedJobId: n.relatedJobId,
              }))}
            />
            <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-text-primary font-serif text-xs text-cream">
              {initials}
            </div>
            <Link href="/" className="hidden text-[13.5px] text-text-muted sm:inline">
              Exit
            </Link>
          </div>
        </div>
        <div className="flex">
          <Sidebar navItems={navItems} />
          <main className="max-w-[1080px] flex-1 px-5 py-7 sm:px-12 sm:py-10">{children}</main>
        </div>
      </div>
    </MobileNavProvider>
  );
}
