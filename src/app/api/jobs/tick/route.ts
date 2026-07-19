import { NextResponse, type NextRequest } from "next/server";
import { getBoss, SCREENING_QUEUE } from "@/lib/jobs/boss";
import { processScreeningRun } from "@/lib/agent/pipeline";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const secret = process.env.JOBS_TICK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "JOBS_TICK_SECRET not configured" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const boss = await getBoss();
  const jobs = await boss.fetch<{ runId: string }>(SCREENING_QUEUE, { batchSize: 3 });

  const results = [];
  for (const job of jobs) {
    try {
      await processScreeningRun(job.data.runId);
      await boss.complete(SCREENING_QUEUE, job.id);
      results.push({ id: job.id, runId: job.data.runId, status: "completed" });
    } catch (err) {
      await boss.fail(SCREENING_QUEUE, job.id, { message: err instanceof Error ? err.message : String(err) });
      results.push({ id: job.id, runId: job.data.runId, status: "failed" });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
