import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("collection cursor unpadded migration", () => {
  const sql = readFileSync(
    resolve(__dirname, "../../supabase/migrations/20260906220000_phase_5_collection_cursor_unpadded.sql"),
    "utf8",
  ).replaceAll("\r\n", "\n");

  it("replaces only encode_collection_cursor with the same signature", () => {
    expect(sql).toMatch(/create or replace function private\.encode_collection_cursor\(/i);
    expect(sql).toContain("p_created_at timestamp with time zone");
    expect(sql).toContain("p_id uuid");
    expect(sql).not.toMatch(/^\s*drop function/im);
    expect(sql).not.toMatch(/decode_collection_cursor/);
  });

  it("converts Postgres MIME base64 into RFC 4648 base64url", () => {
    expect(sql).toContain("encode(");
    expect(sql).toContain("'base64'");
    expect(sql).toContain("E'\\n'");
    expect(sql).toContain("translate(");
    expect(sql).toContain("'+/'");
    expect(sql).toContain("'-_'");
  });
});
