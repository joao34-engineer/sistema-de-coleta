import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("inspect_document_share migration", () => {
  const migrationPath = resolve(__dirname, "../../supabase/migrations/20260905183000_inspect_document_share.sql");
  const sql = readFileSync(migrationPath, "utf8");

  it("defines inspect_document_share without incrementing download_count", () => {
    expect(sql).toContain("inspect_document_share");
    expect(sql).not.toMatch(/download_count\s*\+\s*1/i);
    expect(sql).not.toMatch(/set\s+download_count/i);
  });
});
