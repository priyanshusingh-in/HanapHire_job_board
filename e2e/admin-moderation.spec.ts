import { expect, test } from "@playwright/test";
import { E2E_ADMIN, E2E_PASSWORD } from "./test-users";

test("admin removes a flagged listing and it stays gone after reload", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("Email address").fill(E2E_ADMIN.email);
  await page.getByPlaceholder("Password").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();

  await expect(page).toHaveURL(/\/admin/);

  await page.goto("/admin/moderation");
  // Scoped to the row's own class combo ("flex items-center
  // justify-between") — no descendant div inside a row shares that exact
  // combination (the title/meta wrapper is a bare div, the action wrapper
  // is "flex items-center gap-3.5"), so this matches exactly one row,
  // unlike a plain `div` + hasText which also matches the list's outer
  // wrapper (and therefore every row's Remove button).
  const row = page
    .locator("div.flex.items-center.justify-between", { hasText: "E2E Flagged Test Listing" })
    .first();
  await expect(row).toBeVisible();

  await row.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByText("E2E Flagged Test Listing")).toHaveCount(0);

  await page.reload();
  await expect(page.getByText("E2E Flagged Test Listing")).toHaveCount(0);
});
