import path from "node:path";

export function assertOutputDirOutsideRepo(outputDir: string, repoRoot: string = process.cwd()): void {
  const resolvedOutput = path.resolve(outputDir);
  const resolvedRepo = path.resolve(repoRoot);
  const relative = path.relative(resolvedRepo, resolvedOutput);
  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
    throw new Error("BACKUP_OUTPUT_DIR deve ficar fora do repositório.");
  }
}
