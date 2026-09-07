import { describe, expect, it } from "vitest";
import { collectionCursorSchema, encodeCollectionCursor } from "@/_pages/collection-lifecycle/model/pagination";
import { collectionListResultSchema } from "@/_pages/collection-lifecycle/model/contracts";

const sampleCursor = {
  createdAt: "2026-09-06T12:10:12.320347+00:00",
  id: "b77fe441-2af5-4ff0-9181-460ec72d04ef",
} as const;

describe("collection cursor", () => {
  it("accepts a compact base64url cursor from the encoder", () => {
    const encoded = encodeCollectionCursor(sampleCursor);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(collectionCursorSchema.parse(encoded)).toBe(encoded);
  });

  it("rejects a MIME-wrapped cursor instead of sanitizing it", () => {
    const compact = encodeCollectionCursor(sampleCursor);
    const wrapped = `${compact.slice(0, 76)}\n${compact.slice(76)}`;
    expect(collectionCursorSchema.safeParse(wrapped).success).toBe(false);
  });

  it("parses a list payload with a compact nextCursor", () => {
    const parsed = collectionListResultSchema.parse({
      items: [
        {
          id: sampleCursor.id,
          officialCode: "MJT-2026-900001",
          status: "collected",
          customerName: "Cliente Teste",
          customerTaxId: "52998224725",
          customerPhone: "11999990000",
          collectedAt: "2026-09-06T12:13:05.756+00:00",
          createdAt: sampleCursor.createdAt,
          rowVersion: 6,
        },
      ],
      nextCursor: encodeCollectionCursor(sampleCursor),
      totalCount: 6,
    });
    expect(parsed.nextCursor).toBe(encodeCollectionCursor(sampleCursor));
    expect(parsed.totalCount).toBe(6);
  });
});
