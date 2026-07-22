"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "relevant", label: "Most Relevant" },
  { value: "pay", label: "Highest Pay" },
  { value: "distance", label: "Closest to Me" },
  { value: "newest", label: "Newest" },
];

export function JobsSearchControls() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get("q") ?? "";
  const [search, setSearch] = useState(urlQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resyncs the input when the URL changes from outside this component's
  // own debounced push (browser back/forward, a category link resetting
  // the query, etc.) — without this, `search` only ever reflected whatever
  // was typed at mount and could go stale relative to the actual results.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearch(urlQuery);
  }, [urlQuery]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function pushParams(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page");
    router.push(`/jobs?${params.toString()}`);
  }

  function onSearchChange(value: string) {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => pushParams({ q: value || null }), 350);
  }

  return (
    <div className="mb-6.5 flex gap-3">
      <label htmlFor="job-search" className="sr-only">
        Search job title or company
      </label>
      <input
        id="job-search"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search job title or company"
        className="flex-1 rounded-md border border-text-primary/20 bg-white px-4 py-3.5 text-[15px]"
      />
      <label htmlFor="job-sort" className="sr-only">
        Sort jobs by
      </label>
      <select
        id="job-sort"
        value={searchParams.get("sort") ?? "relevant"}
        onChange={(e) => pushParams({ sort: e.target.value === "relevant" ? null : e.target.value })}
        className="rounded-md border border-text-primary/20 bg-white px-4 py-3.5 text-sm font-medium"
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
