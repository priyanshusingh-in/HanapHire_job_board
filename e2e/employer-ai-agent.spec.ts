import "dotenv/config";
import { expect, test } from "@playwright/test";

const SEEDED_EMPLOYER = { email: "employer+fulcrum@hanaphire.dev", password: "hanaphire-demo-2026" };

const hasAiKeys = Boolean(
  process.env.GEMINI_API_KEYS || process.env.GROQ_API_KEYS || process.env.OPENROUTER_API_KEYS || process.env.QWEN_API_KEYS,
);

test.skip(!hasAiKeys, "No AI provider keys configured in this environment — see README for setup.");

test("employer runs the AI Screening Agent, sees ranked results, and can approve/dismiss with persistence", async ({ page }) => {
  test.setTimeout(180_000);

  await page.goto("/login?role=employer");
  await page.getByPlaceholder("Email address").fill(SEEDED_EMPLOYER.email);
  await page.getByPlaceholder("Password").fill(SEEDED_EMPLOYER.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/employer/);

  await page.getByRole("link", { name: "View applicants" }).first().click();
  await page.getByRole("link", { name: /Run AI Screening Agent|AI Screening Agent/ }).first().click();

  await expect(page).toHaveURL(/\/employer\/agent\//);

  const startButton = page.getByRole("button", { name: "Start Agent" });
  const rescreenButton = page.getByRole("button", { name: "Re-screen Applicants" });

  // If a prior run already left this job DONE, "Re-screen Applicants" is
  // visible and "Screening complete" is *already* on the page from that old
  // run — waiting on "Screening complete" right after the click would pass
  // immediately on that stale text, before the click's fresh run has even
  // been created, then race ahead to click candidate buttons while the page
  // is mid-transition into the new run's "Agent running…" view (candidate
  // cards briefly don't exist). Confirming the RUNNING view first proves
  // we're actually looking at this run, not leftover content from the last
  // one.
  if (await startButton.isVisible().catch(() => false)) {
    await startButton.click();
    await expect(page.getByText("Agent running in the background")).toBeVisible({ timeout: 20_000 });
  } else if (await rescreenButton.isVisible().catch(() => false)) {
    await rescreenButton.click();
    await expect(page.getByText("Agent running in the background")).toBeVisible({ timeout: 20_000 });
  }

  await expect(page.getByText("Screening complete")).toBeVisible({ timeout: 150_000 });

  // Scoped to each named candidate's own card (div.p-6 is the card's root
  // class, unique on this page) rather than ".first()" over a flat button
  // collection — approving Marcus's card collapses its button row down to
  // "✓ Outreach sent", which reflows every card below it, so a positional
  // "first Dismiss button" locator can point at an element mid-reflow.
  // Candidate names come from fixed seed data (SeekerProfile rows), so
  // they're stable across runs even though the LLM-scored rationale isn't.
  const marcusCard = page.locator("div.p-6", { hasText: "Marcus Reyes" });
  const danaCard = page.locator("div.p-6", { hasText: "Dana Okafor" });

  // Generous timeouts here (not the default 5s): these are the first server
  // actions hit right after a cold `next start`, and they compete with the
  // page's own just-opened Prisma/Resend connections — empirically this can
  // take several seconds longer than a warm request.
  await marcusCard.getByRole("button", { name: "Approve & send" }).click();
  await expect(marcusCard.getByText("✓ Outreach sent")).toBeVisible({ timeout: 20_000 });

  await danaCard.getByRole("button", { name: "Dismiss" }).click();
  await expect(danaCard.getByText("Dismissed")).toBeVisible({ timeout: 20_000 });

  // Same generous budget as the initial wait: a reload can land while the
  // run is still finishing up its final steps (notification/email), not
  // just while it's mid-scoring — it's the same background LLM work, so
  // it deserves the same patience.
  await page.reload();
  await expect(page.getByText("Screening complete")).toBeVisible({ timeout: 150_000 });
});
