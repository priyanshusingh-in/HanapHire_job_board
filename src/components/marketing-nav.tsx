"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const MENU_LINKS = [
  { label: "Find Work", href: "/jobs" },
  // Signup, not login — every other "I want to hire" CTA on the site
  // (hero, footer, this same overlay's bottom button) points at
  // /signup?role=employer; this one was the odd one out, sending
  // first-time visitors to a "Welcome back" login form instead.
  { label: "Hire Talent", href: "/signup?role=employer" },
  { label: "Company Directory", href: "/companies" },
];

const ROLE_HOME: Record<string, string> = {
  SEEKER: "/dashboard",
  EMPLOYER: "/employer",
  ADMIN: "/admin",
};

export function MarketingNav({ viewerRole }: { viewerRole: "SEEKER" | "EMPLOYER" | "ADMIN" | null }) {
  const [open, setOpen] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  function close() {
    setOpen(false);
    menuButtonRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        close();
        return;
      }
      if (e.key !== "Tab" || !overlayRef.current) return;

      const focusable = overlayRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])',
      );
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
  }, [open]);

  return (
    <>
      <Link
        href="/"
        className="fixed top-4 left-6 z-40 flex h-[42px] items-center justify-center rounded-full bg-ink px-3.5 shadow-[0_2px_10px_rgba(21,19,15,0.22)]"
      >
        <Image src="/logo.png" alt="HanapHire" width={100} height={26} className="h-[26px] w-auto brightness-0 invert" priority />
      </Link>

      <button
        ref={menuButtonRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Open menu"
        className="fixed top-6 right-8 z-40 flex h-[46px] w-[46px] items-center justify-center rounded-full border-none bg-text-primary shadow-[0_4px_14px_rgba(21,19,15,0.22)]"
      >
        <span className="flex flex-col gap-[5px]">
          <span className="block h-[1.5px] w-4 bg-cream" />
          <span className="block h-[1.5px] w-4 bg-cream" />
        </span>
      </button>

      {open && (
        <div
          ref={overlayRef}
          role="dialog"
          aria-modal="true"
          aria-label="Site menu"
          className="animate-[overlay-in_0.35s_ease] fixed inset-0 z-[100] flex flex-col bg-ink"
        >
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-8 py-5">
            <Link href="/" onClick={close} className="flex items-center">
              <Image src="/logo.png" alt="HanapHire" width={120} height={32} className="h-8 w-auto brightness-0 invert" />
            </Link>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={close}
              aria-label="Close menu"
              className="flex h-[38px] w-[38px] items-center justify-center rounded-full border border-cream/30 text-cream"
            >
              ✕
            </button>
          </div>

          <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center px-8">
            {MENU_LINKS.map((link, i) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={close}
                style={{ animationDelay: `${0.05 + i * 0.1}s` }}
                className="animate-[menu-link-in_0.5s_ease_both] block cursor-pointer py-3.5 font-serif text-4xl italic text-cream sm:text-5xl"
              >
                {link.label}
              </Link>
            ))}
            <div
              style={{ animationDelay: "0.4s" }}
              className="animate-[menu-link-in_0.5s_ease_both] mt-12 flex gap-4"
            >
              {viewerRole ? (
                <Link
                  href={ROLE_HOME[viewerRole]}
                  onClick={close}
                  className="rounded-md bg-accent px-5 py-3 text-sm font-semibold text-white"
                >
                  Go to Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={close}
                    className="rounded-md border border-cream/28 px-[22px] py-3 text-sm font-semibold text-cream"
                  >
                    Log in
                  </Link>
                  <Link
                    href="/signup?role=employer"
                    onClick={close}
                    className="rounded-md bg-accent px-5 py-3 text-sm font-semibold text-white"
                  >
                    Post a Job
                  </Link>
                </>
              )}
            </div>
          </div>

          <div className="mx-auto w-full max-w-6xl px-8 pt-6 pb-8">
            <Link
              href="/admin"
              onClick={close}
              className="cursor-pointer text-[13.5px] text-text-faint"
            >
              Admin console →
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
