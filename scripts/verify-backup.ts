import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvLocal } from "./backup/env";
import { parseBackupManifest } from "./backup/manifest";
import { verifyBackupBundle } from "./backup/verify-bundle";

async function main(): Promise<void> {
  loadEnvLocal();
  const inputDir = process.env["BACKUP_INPUT_DIR"] ?? process.env["BACKUP_OUTPUT_DIR"];
  if (!inputDir) throw new Error("Defina BACKUP_INPUT_DIR ou BACKUP_OUTPUT_DIR.");
  const bundleRoot = path.resolve(inputDir);
  const raw = JSON.parse(await readFile(path.join(bundleRoot, "manifest.json"), "utf8")) as unknown;
  const manifest = parseBackupManifest(raw);
  const result = await verifyBackupBundle(bundleRoot, manifest);
  if (!result.ok) {
    console.error(JSON.stringify({ event: "backup_verify_failed", failureCount: result.failures.length }));
    process.exitCode = 1;
    return;
  }
  console.log(
    JSON.stringify({
      event: "backup_verify",
      sourceProjectRef: manifest.sourceProjectRef,
      checked: result.checked,
      objectCounts: manifest.objectCounts,
    }),
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "backup_verify_failed";
  console.error(JSON.stringify({ event: "backup_verify_error", message }));
  process.exitCode = 1;
});
