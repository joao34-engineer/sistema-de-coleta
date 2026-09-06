import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("list_collections search totals migration", () => {
  const migrationPath = resolve(
    __dirname,
    "../../supabase/migrations/20260906190000_phase_5_list_collections_search_totals.sql",
  );
  const sql = readFileSync(migrationPath, "utf8");

  it("drops the 9-arg function then creates the 11-arg signature", () => {
    expect(sql).toMatch(
      /drop function if exists public\.list_collections\(\s*text, text, text, text, text, timestamptz, timestamptz, text, integer\)/i,
    );
    expect(sql).toMatch(/p_q text default null,\s*p_statuses text\[\] default null/);
  });

  it("re-grants execute to authenticated and revokes public, anon and service_role", () => {
    expect(sql).toContain(
      "revoke execute on function public.list_collections(\n  text, text, text, text, text, timestamptz, timestamptz, text, integer, text, text[])\n  from public, anon, service_role;",
    );
    expect(sql).toContain(
      "grant execute on function public.list_collections(\n  text, text, text, text, text, timestamptz, timestamptz, text, integer, text, text[])\n  to authenticated;",
    );
  });

  it("adds filtered CTE clauses, filtered_count and totalCount", () => {
    expect(sql).toContain("and (p_statuses is null or collection_record.status = any (p_statuses))");
    expect(sql).toContain("filtered_count as (");
    expect(sql).toContain("'totalCount'");
  });

  it("creates collection_dashboard_summary with the same grant posture", () => {
    expect(sql).toContain("create or replace function public.collection_dashboard_summary(");
    expect(sql).toContain(
      "revoke execute on function public.collection_dashboard_summary(text[], text[])\n  from public, anon, service_role;",
    );
    expect(sql).toContain(
      "grant execute on function public.collection_dashboard_summary(text[], text[])\n  to authenticated;",
    );
  });
});
