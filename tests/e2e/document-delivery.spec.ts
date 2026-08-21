import { test, expect } from "@playwright/test";

test("share links do not expose the protected collection route anonymously", async ({ page }) => {
  await page.goto("/d/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  await expect(page.getByRole("heading", { name: /link indisponível|documento protegido/i })).toBeVisible();
  await expect(page).not.toHaveURL(/coletas|dashboard/);
});
