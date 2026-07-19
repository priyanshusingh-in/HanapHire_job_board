"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { label: string; href: string };

export function Sidebar({ navItems }: { navItems: NavItem[] }) {
  const pathname = usePathname();

  return (
    <aside className="min-h-[calc(100vh-63px)] w-[210px] shrink-0 border-r border-text-primary/12 bg-paper py-6">
      {navItems.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`mb-0.5 block w-full border-l-2 px-6 py-2.5 text-left ${
              active
                ? "border-accent font-serif text-[15px] font-medium text-accent"
                : "border-transparent text-[14px] text-text-body"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </aside>
  );
}
