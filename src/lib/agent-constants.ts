// A run stuck RUNNING past this long never got picked up by a tick (the
// fire-and-forget kickTick() failed, or — in production — the cron hasn't
// hit yet). startAgent's concurrency guard uses this to decide when a
// "running" run is actually dead and safe to replace; agent-panel.tsx aligns
// its "offer a retry" timer to the same threshold. Kept in its own
// non-"use server" module because a "use server" file may only export async
// functions — exporting a plain constant from actions/agent.ts breaks the
// server action reference manifest.
export const STALE_RUN_MS = 3 * 60 * 1000;
