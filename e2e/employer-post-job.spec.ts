import { expect, test } from "@playwright/test";
import { E2E_EMPLOYER, E2E_PASSWORD } from "./test-users";

test("employer logs in, posts a job, and sees it in their postings", async ({ page }) => {
  await page.goto("/login?role=employer");
  await page.getByPlaceholder("Email address").fill(E2E_EMPLOYER.email);
  await page.getByPlaceholder("Password").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();

  await expect(page).toHaveURL(/\/employer/);

  await page.goto("/employer/jobs/new");

  // Company name field only renders before the employer has a company yet
  // (first post ever) — idempotent across repeated test runs either way.
  const companyNameField = page.locator("#companyName");
  if (await companyNameField.isVisible().catch(() => false)) {
    await companyNameField.fill("E2E Test Co.");
  }

  const uniqueTitle = `E2E Posted Job ${Date.now()}`;
  await page.locator("#title").fill(uniqueTitle);
  await page.locator("#category").selectOption("Delivery");
  await page.locator("#payAmount").fill("25");
  await page.locator("#payType").selectOption("hourly");
  await page.locator("#location").fill("Test City, TC");
  await page.locator("#shift").fill("Mon-Fri, 9am-5pm");
  await page.locator("#description").fill("A fixture job posted by the e2e test suite.");
  await page.locator("#criteria").fill("Reliable, punctual");

  await page.getByRole("button", { name: "Publish job" }).click();

  await expect(page).toHaveURL(/\/employer/);
  // .first() — the newly-posted job is auto-selected, so its title also
  // appears again in the "Applicants — {title}" heading below.
  await expect(page.getByText(uniqueTitle).first()).toBeVisible();
});
