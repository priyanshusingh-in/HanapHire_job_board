"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { useMobileNav } from "@/components/mobile-nav-context";

export type NavItem = { label: string; href: string };

export function Sidebar({ navItems }: { navItems: NavItem[] }) {
  const pathname = usePathname();
  const { open, setOpen } = useMobileNav();
  const overlayRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setOpen(false), [pathname, setOpen]);

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key !== "Tab" || !overlayRef.current) return;

      const focusable = overlayRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, setOpen]);

  function renderLinks() {
    return navItems.map((item) => {
      const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
      return (
        <Link
          key={item.href}
          href={item.href}
          aria-current={active ? "page" : undefined}
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
  }

  return (
    <>
      <aside className="hidden min-h-[calc(100vh-63px)] w-[210px] shrink-0 border-r border-text-primary/12 bg-paper py-6 sm:block">
        {renderLinks()}
      </aside>

      {open && (
        <div
          ref={overlayRef}
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
            {/* The header's own toggle button sits underneath this overlay
                once open (a plain sibling with no z-index loses to a fixed,
                positive-z-index element) — a real close control needs to
                live inside the overlay itself, same as marketing-nav.tsx's
                pattern, rather than relying on that external button. */}
            <div className="mb-2 flex justify-end px-4">
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-text-primary/16"
              >
                ✕
              </button>
            </div>
            {renderLinks()}
          </aside>
        </div>
      )}
    </>
  );
}
