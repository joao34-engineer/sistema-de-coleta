import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import { emailShareSchema, shareCreateSchema } from "@/_pages/collection-documents/api/delivery/contracts";
import { documentShareExpiresAt, DOCUMENT_SHARE_EXPIRATION_MS, DOCUMENT_SHARE_MAX_DOWNLOADS } from "@/_pages/collection-documents/api/delivery/shares.server";
import {
  buildDocumentShareUrl,
  hashDocumentShareToken,
  isDocumentShareToken,
  matchesDocumentShareTokenHash,
} from "@/_pages/collection-documents/api/delivery/share-token";

const shareToken = "a".repeat(64);

describe("document share delivery", () => {
  it("fixes link expiration and consumption quota at the approved policy", () => {
    const start = new Date("2026-08-21T12:00:00.000Z");

    expect(DOCUMENT_SHARE_MAX_DOWNLOADS).toBe(20);
    expect(documentShareExpiresAt(start)).toBe(new Date(start.getTime() + DOCUMENT_SHARE_EXPIRATION_MS).toISOString());
    expect(shareCreateSchema.safeParse({ shareType: "pdf" }).success).toBe(true);
    expect(shareCreateSchema.safeParse({ shareType: "pdf", expiresAt: "2026-09-30T12:00:00.000Z" }).success).toBe(false);
    expect(shareCreateSchema.safeParse({ shareType: "pdf", maxDownloads: 19 }).success).toBe(false);
  });

  it("accepts a raw share token only at the email request boundary", () => {
    expect(emailShareSchema.safeParse({ email: "destinatario@example.com", shareToken }).success).toBe(true);
    expect(emailShareSchema.safeParse({ email: "destinatario@example.com", shareToken, shareUrl: `https://mjt.example.com/d/${shareToken}` }).success).toBe(false);
    expect(emailShareSchema.safeParse({ email: "destinatario@example.com", shareToken: "A".repeat(64) }).success).toBe(false);
  });

  it("hashes and compares the token without accepting a different value", () => {
    const tokenHash = hashDocumentShareToken(shareToken);

    expect(isDocumentShareToken(shareToken)).toBe(true);
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(matchesDocumentShareTokenHash(shareToken, tokenHash)).toBe(true);
    expect(matchesDocumentShareTokenHash("b".repeat(64), tokenHash)).toBe(false);
    expect(matchesDocumentShareTokenHash("invalid", tokenHash)).toBe(false);
  });

  it("builds the private link from the configured application origin only", () => {
    expect(buildDocumentShareUrl("https://mjt.example.com/app/?ignored=true#fragment", shareToken)).toBe(`https://mjt.example.com/app/d/${shareToken}`);
    expect(() => buildDocumentShareUrl("ftp://mjt.example.com", shareToken)).toThrow("document_share_base_url_invalid");
  });

  it("sets no-store and no-referrer headers for the public share page", async () => {
    if (!nextConfig.headers) throw new Error("next_headers_not_configured");
    const rules = await nextConfig.headers();
    const shareRule = rules.find((rule) => rule.source === "/d/:shareToken*");

    expect(shareRule?.headers).toEqual(expect.arrayContaining([
      { key: "Cache-Control", value: "private, no-store, max-age=0" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Robots-Tag", value: "noindex, noarchive" },
    ]));
  });
});
