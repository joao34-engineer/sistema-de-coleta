import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { BackupManifest, BackupManifestObject } from "./manifest";

export type BundleVerifyResult =
  | { ok: true; checked: number }
  | { ok: false; failures: readonly string[] };

export function sha256Hex(bytes: Uint8Array | Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function storageObjectRelativePath(object: BackupManifestObject): string {
  return path.join("storage", object.bucket, ...object.path.split("/"));
}

export async function verifyBackupBundle(
  bundleRoot: string,
  manifest: BackupManifest,
): Promise<BundleVerifyResult> {
  const failures: string[] = [];
  for (const object of manifest.objects) {
    const absolute = path.join(bundleRoot, storageObjectRelativePath(object));
    try {
      const bytes = await readFile(absolute);
      if (bytes.byteLength !== object.byteSize) {
        failures.push(`${object.bucket}/${object.path}: size mismatch`);
        continue;
      }
      const digest = sha256Hex(bytes);
      if (digest !== object.sha256) {
        failures.push(`${object.bucket}/${object.path}: sha256 mismatch`);
      }
    } catch {
      failures.push(`${object.bucket}/${object.path}: missing file`);
    }
  }
  if (failures.length > 0) return { ok: false, failures };
  return { ok: true, checked: manifest.objects.length };
}
