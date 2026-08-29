import { describe, expect, it } from "vitest";
import { parseBackupManifest } from "../../scripts/backup/manifest";

const sha = "a".repeat(64);

describe("backup manifest", () => {
  it("parses a strict valid manifest", () => {
    const manifest = parseBackupManifest({
      version: 1,
      createdAt: "2026-08-29T12:00:00.000Z",
      sourceProjectRef: "mvpprojectref00001",
      objectCounts: { "collection-documents": 1 },
      objects: [
        {
          bucket: "collection-documents",
          path: "1/uuid/doc.pdf",
          byteSize: 12,
          sha256: sha,
        },
      ],
    });
    expect(manifest.objects).toHaveLength(1);
  });

  it("rejects unknown top-level fields (no PII bags)", () => {
    expect(() =>
      parseBackupManifest({
        version: 1,
        createdAt: "2026-08-29T12:00:00.000Z",
        sourceProjectRef: "mvpprojectref00001",
        objectCounts: {},
        objects: [],
        customerName: "should-not-appear",
      }),
    ).toThrow();
  });

  it("rejects invalid sha256", () => {
    expect(() =>
      parseBackupManifest({
        version: 1,
        createdAt: "2026-08-29T12:00:00.000Z",
        sourceProjectRef: "mvpprojectref00001",
        objectCounts: {},
        objects: [
          {
            bucket: "collection-signatures",
            path: "1/a/b.png",
            byteSize: 1,
            sha256: "not-a-hash",
          },
        ],
      }),
    ).toThrow();
  });
});
