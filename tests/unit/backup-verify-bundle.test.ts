import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { BackupBucketId } from "../../scripts/backup/inventory";
import type { BackupManifest } from "../../scripts/backup/manifest";
import { sha256Hex, storageObjectRelativePath, verifyBackupBundle } from "../../scripts/backup/verify-bundle";

async function writeObject(root: string, bucket: BackupBucketId, objectPath: string, bytes: Buffer): Promise<void> {
  const relative = storageObjectRelativePath({
    bucket,
    path: objectPath,
    byteSize: bytes.byteLength,
    sha256: sha256Hex(bytes),
  });
  const absolute = path.join(root, relative);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, bytes);
}

describe("backup verify bundle", () => {
  it("accepts matching synthetic PDF and PNG bytes", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "mjt-backup-ok-"));
    const pdf = Buffer.from("%PDF-1.4 synthetic");
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    await writeObject(root, "collection-documents", "1/c/a.pdf", pdf);
    await writeObject(root, "collection-signatures", "1/c/b.png", png);

    const manifest: BackupManifest = {
      version: 1,
      createdAt: "2026-08-29T12:00:00.000Z",
      sourceProjectRef: "mvpprojectref00001",
      objectCounts: {
        "collection-documents": 1,
        "collection-signatures": 1,
      },
      objects: [
        {
          bucket: "collection-documents",
          path: "1/c/a.pdf",
          byteSize: pdf.byteLength,
          sha256: sha256Hex(pdf),
        },
        {
          bucket: "collection-signatures",
          path: "1/c/b.png",
          byteSize: png.byteLength,
          sha256: sha256Hex(png),
        },
      ],
    };

    await expect(verifyBackupBundle(root, manifest)).resolves.toEqual({ ok: true, checked: 2 });
  });

  it("fails when a file is missing", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "mjt-backup-missing-"));
    const manifest: BackupManifest = {
      version: 1,
      createdAt: "2026-08-29T12:00:00.000Z",
      sourceProjectRef: "mvpprojectref00001",
      objectCounts: { "collection-documents": 1 },
      objects: [
        {
          bucket: "collection-documents",
          path: "1/c/missing.pdf",
          byteSize: 4,
          sha256: "b".repeat(64),
        },
      ],
    };
    const result = await verifyBackupBundle(root, manifest);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failures[0]).toMatch(/missing file/);
  });

  it("fails on sha256 mismatch", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "mjt-backup-hash-"));
    const pdf = Buffer.from("%PDF-bad-hash");
    await writeObject(root, "collection-documents", "1/c/a.pdf", pdf);
    const manifest: BackupManifest = {
      version: 1,
      createdAt: "2026-08-29T12:00:00.000Z",
      sourceProjectRef: "mvpprojectref00001",
      objectCounts: { "collection-documents": 1 },
      objects: [
        {
          bucket: "collection-documents",
          path: "1/c/a.pdf",
          byteSize: pdf.byteLength,
          sha256: "c".repeat(64),
        },
      ],
    };
    const result = await verifyBackupBundle(root, manifest);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failures[0]).toMatch(/sha256 mismatch/);
  });
});
