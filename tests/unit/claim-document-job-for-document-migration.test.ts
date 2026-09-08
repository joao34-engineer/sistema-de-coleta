import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("claim_document_job_for_document migration", () => {
  const sql = readFileSync(
    resolve(__dirname, "../../supabase/migrations/20260908010000_claim_document_job_for_document.sql"),
    "utf8",
  );

  it("adds a document-scoped claim without dropping the FIFO claim", () => {
    expect(sql).toMatch(/create or replace function public\.claim_document_job_for_document\(/i);
    expect(sql).toContain("document_id = p_document_id");
    expect(sql).toContain("for update skip locked");
    expect(sql).not.toMatch(/drop function/i);
    expect(sql).not.toMatch(/drop table/i);
  });

  it("grants execute only to service_role", () => {
    expect(sql).toMatch(/revoke execute on function public\.claim_document_job_for_document\(text, integer, uuid\) from public, anon, authenticated/i);
    expect(sql).toMatch(/grant execute on function public\.claim_document_job_for_document\(text, integer, uuid\) to service_role/i);
  });
});
