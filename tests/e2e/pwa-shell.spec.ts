import { expect, test } from "@playwright/test";

test("serves the service worker with a revalidation cache header", async ({ request }) => {
  const response = await request.get("/sw.js");
  expect(response.status()).toBe(200);

  const body = await response.text();
  expect(body).toContain("addEventListener");
  expect(body).toMatch(/fetch/);

  const cacheControl = response.headers()["cache-control"] ?? "";
  expect(cacheControl).toMatch(/no-store|no-cache|must-revalidate/);
});

test("serves a standalone web manifest with icons", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.status()).toBe(200);

  const manifest: unknown = await response.json();
  expect(manifest).toEqual(
    expect.objectContaining({
      display: "standalone",
      icons: expect.arrayContaining([expect.objectContaining({ src: expect.any(String) })]),
    }),
  );
});
