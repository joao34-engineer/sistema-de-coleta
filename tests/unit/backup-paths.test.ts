import path from "node:path";
import { describe, expect, it } from "vitest";
import { assertOutputDirOutsideRepo } from "../../scripts/backup/paths";

describe("backup output path", () => {
  it("refuses an output directory inside the repository", () => {
    const repo = path.resolve(".");
    expect(() => assertOutputDirOutsideRepo(path.join(repo, "backups", "x"), repo)).toThrow(/fora do repositório/);
  });

  it("allows an absolute directory outside the repository", () => {
    const repo = path.resolve(".");
    const outside = path.resolve(repo, "..", "backups-coleta-mjt-test");
    expect(() => assertOutputDirOutsideRepo(outside, repo)).not.toThrow();
  });
});
