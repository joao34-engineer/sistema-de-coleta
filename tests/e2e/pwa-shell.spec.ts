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
      icons: expect.arrayContaining([
        expect.objectContaining({ src: "/icons/apple-touch-icon.png", sizes: "180x180" }),
        expect.objectContaining({ src: expect.any(String) }),
      ]),
    }),
  );
});

test("serves the 180 apple-touch-icon", async ({ request }) => {
  const response = await request.get("/icons/apple-touch-icon.png");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"] ?? "").toMatch(/image\/png/);
});
