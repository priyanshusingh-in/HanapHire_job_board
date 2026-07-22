"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-8">
      <div className="max-w-md border border-text-primary/14 bg-white p-9 text-center">
        <h1 className="mb-2 font-serif text-2xl font-medium tracking-tight">Something went wrong</h1>
        <p className="mb-6 text-sm text-text-muted">
          An unexpected error occurred. You can try again, or head back to the homepage.
        </p>
        <div className="flex justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-white"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-md border border-text-primary/20 bg-white px-5 py-2.5 text-sm font-medium text-text-body"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
