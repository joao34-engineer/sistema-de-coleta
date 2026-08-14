import { test, expect } from "@playwright/test";

test("company settings route is protected", async ({ page }) => {
  await page.goto("/configuracoes/empresa");
  await expect(page).toHaveURL(/\/login$/);
});
