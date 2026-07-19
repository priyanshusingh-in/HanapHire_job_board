import Image from "next/image";
import Link from "next/link";
import { NavItem, Sidebar } from "@/components/sidebar";

const ROLE_LABEL: Record<string, string> = {
  SEEKER: "Job Seeker Account",
  EMPLOYER: "Employer Account",
  ADMIN: "Admin Console",
};

export function AppShell({
  role,
  name,
  navItems,
  children,
}: {
  role: "SEEKER" | "EMPLOYER" | "ADMIN";
  name: string;
  navItems: NavItem[];
  children: React.ReactNode;
}) {
  const initials =
    name
      .split(" ")
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  return (
    <div className="min-h-screen">
      <div className="flex items-center justify-between border-b border-text-primary/12 bg-paper px-7 py-4">
        <Link href="/">
          <Image src="/logo.png" alt="HanapHire" width={140} height={34} className="h-[34px] w-auto" />
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-xs tracking-wide text-text-muted uppercase">
            {ROLE_LABEL[role]}
          </span>
          <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-text-primary font-serif text-xs text-cream">
            {initials}
          </div>
          <Link href="/" className="text-[13.5px] text-text-muted">
            Exit
          </Link>
        </div>
      </div>
      <div className="flex">
        <Sidebar navItems={navItems} />
        <main className="max-w-[1080px] flex-1 px-12 py-10">{children}</main>
      </div>
    </div>
  );
}
