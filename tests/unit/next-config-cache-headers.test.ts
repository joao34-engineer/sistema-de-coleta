/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

async function headerRules() {
  if (!nextConfig.headers) throw new Error("next_headers_not_configured");
  return nextConfig.headers();
}

function cacheControl(headers: ReadonlyArray<{ key: string; value: string }>): string | undefined {
  return headers.find((header) => header.key === "Cache-Control")?.value;
}

describe("next.config cache headers", () => {
  it("keeps private no-store on the catch-all HTML and API paths", async () => {
    const rules = await headerRules();
    const catchAll = rules.find((rule) => rule.source === "/(.*)");

    expect(catchAll?.headers).toEqual(
      expect.arrayContaining([
        { key: "Cache-Control", value: "private, no-store" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
      ]),
    );
    expect(catchAll?.headers.some((header) => header.key === "Content-Security-Policy")).toBe(true);
  });

  it("overrides hashed Next static chunks with a long public cache", async () => {
    const rules = await headerRules();
    const staticRule = rules.find((rule) => rule.source === "/_next/static/:path*");

    expect(cacheControl(staticRule?.headers ?? [])).toBe("public, max-age=31536000, immutable");
    expect(cacheControl(staticRule?.headers ?? [])).not.toMatch(/no-store/);
  });

  it("allows a short public cache on unhashed PWA icons", async () => {
    const rules = await headerRules();
    const iconsRule = rules.find((rule) => rule.source === "/icons/:path*");

    expect(cacheControl(iconsRule?.headers ?? [])).toBe("public, max-age=86400");
    expect(cacheControl(iconsRule?.headers ?? [])).not.toMatch(/no-store/);
  });

  it("keeps share, verification and service-worker responses uncached", async () => {
    const rules = await headerRules();
    const shareRule = rules.find((rule) => rule.source === "/d/:shareToken*");
    const verifyRule = rules.find((rule) => rule.source === "/verificar/:verificationToken*");
    const swRule = rules.find((rule) => rule.source === "/sw.js");

    expect(cacheControl(shareRule?.headers ?? [])).toBe("private, no-store, max-age=0");
    expect(cacheControl(verifyRule?.headers ?? [])).toBe("private, no-store, max-age=0");
    expect(cacheControl(swRule?.headers ?? [])).toMatch(/no-store/);
  });
});
