"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useMobileNav } from "@/components/mobile-nav-context";

export type NavItem = { label: string; href: string };

export function Sidebar({ navItems }: { navItems: NavItem[] }) {
  const pathname = usePathname();
  const { open, setOpen } = useMobileNav();

  useEffect(() => setOpen(false), [pathname, setOpen]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, setOpen]);

  const links = navItems.map((item) => {
    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`mb-0.5 block w-full border-l-2 px-6 py-2.5 text-left ${
          active
            ? "border-accent font-serif text-[15px] font-medium text-accent-hover"
            : "border-transparent text-[14px] text-text-body"
        }`}
      >
        {item.label}
      </Link>
    );
  });

  return (
    <>
      <aside className="hidden min-h-[calc(100vh-63px)] w-[210px] shrink-0 border-r border-text-primary/12 bg-paper py-6 sm:block">
        {links}
      </aside>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
          className="fixed inset-0 z-40 bg-ink/40 sm:hidden"
          onClick={() => setOpen(false)}
        >
          <aside
            className="min-h-full w-[240px] border-r border-text-primary/12 bg-paper py-6"
            onClick={(e) => e.stopPropagation()}
          >
            {links}
          </aside>
        </div>
      )}
    </>
  );
}
