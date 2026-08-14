import { test, expect } from "@playwright/test";

const adminEmail = process.env["E2E_ADMIN_EMAIL"];
const adminPassword = process.env["E2E_ADMIN_PASSWORD"];

test("administrator can open the protected foundation routes", async ({ page }) => {
  test.skip(!adminEmail || !adminPassword, "E2E_ADMIN_EMAIL e E2E_ADMIN_PASSWORD não foram fornecidos.");

  await page.goto("/login");
  await page.getByLabel("E-mail").fill(adminEmail ?? "");
  await page.getByLabel("Senha").fill(adminPassword ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Configuração institucional" })).toBeVisible();

  await page.getByRole("link", { name: "Abrir configurações" }).click();
  await expect(page).toHaveURL(/\/configuracoes\/empresa$/);
  await expect(page.getByRole("heading", { name: "Dados institucionais" })).toBeVisible();

  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/login$/);
});
