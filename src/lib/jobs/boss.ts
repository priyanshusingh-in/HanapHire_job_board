import "server-only";
import { PgBoss } from "pg-boss";

export const SCREENING_QUEUE = "screening-run";

const globalForBoss = globalThis as unknown as { boss: PgBoss | undefined };

async function createBoss() {
  // Needs the direct (non-pooled) connection — pg-boss uses session-level
  // LISTEN/NOTIFY, which PgBouncer's transaction pooling mode can't support.
  const boss = new PgBoss(process.env.DIRECT_URL!);
  boss.on("error", (err) => console.error("[pg-boss]", err));
  await boss.start();
  await boss.createQueue(SCREENING_QUEUE);
  return boss;
}

let bossPromise: Promise<PgBoss> | undefined;

/** Lazily-started, process-wide pg-boss instance (safe to call repeatedly — start()/createQueue() are idempotent). */
export function getBoss(): Promise<PgBoss> {
  if (globalForBoss.boss) return Promise.resolve(globalForBoss.boss);
  if (!bossPromise) {
    bossPromise = createBoss().then((boss) => {
      globalForBoss.boss = boss;
      return boss;
    });
  }
  return bossPromise;
}
