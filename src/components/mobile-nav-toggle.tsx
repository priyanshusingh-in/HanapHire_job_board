"use client";

import { useMobileNav } from "@/components/mobile-nav-context";

export function MobileNavToggle() {
  const { open, setOpen } = useMobileNav();

  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      aria-expanded={open}
      aria-label={open ? "Close menu" : "Open menu"}
      className="flex h-[30px] w-[30px] items-center justify-center rounded-full border border-text-primary/16 sm:hidden"
    >
      <span aria-hidden="true">{open ? "✕" : "☰"}</span>
    </button>
  );
}
