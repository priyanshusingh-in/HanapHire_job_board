import { expect, test } from "@playwright/test";
import { E2E_PASSWORD, E2E_SEEKER } from "./test-users";

test("seeker logs in, filters jobs, applies, and sees it in their dashboard", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("Email address").fill(E2E_SEEKER.email);
  await page.getByPlaceholder("Password").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();

  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto("/jobs?category=Warehouse");
  await expect(page.getByText(/jobs available/)).toBeVisible();

  // First job title link and first "Apply Now" button both correspond to
  // the same top row in listing order.
  const jobTitle = await page.locator('a[href^="/jobs/"]').first().innerText();

  await page.getByRole("button", { name: "Apply Now" }).first().click();
  // Generous timeout: the first server action hit right after a cold
  // `next start` competes with the page's own just-opened Prisma
  // connections and can take longer than the default 5s.
  await expect(page.getByRole("button", { name: "Applied ✓" }).first()).toBeVisible({ timeout: 20_000 });

  await page.goto("/dashboard?tab=applications");
  await expect(page.getByText(jobTitle, { exact: true }).first()).toBeVisible();
});
