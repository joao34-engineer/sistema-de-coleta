import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("list_collections itemCount migration", () => {
  const migrationPath = resolve(
    __dirname,
    "../../supabase/migrations/20260914180000_list_collections_item_count.sql",
  );
  const sql = readFileSync(migrationPath, "utf8").replaceAll("\r\n", "\n");

  it("replaces the 11-arg function without dropping it", () => {
    expect(sql).toContain("create or replace function public.list_collections(");
    expect(sql).toMatch(/p_q text default null,\s*p_statuses text\[\] default null/);
    expect(sql).not.toMatch(/drop function/i);
  });

  it("counts live collection_items rows into itemCount", () => {
    expect(sql).toContain("'itemCount'");
    expect(sql).toContain("from public.collection_items as item_record");
    expect(sql).toContain("item_record.removed_at is null");
    expect(sql).toContain("item_record.collection_id = page.id");
    expect(sql).toContain("item_record.organization_id = page.organization_id");
  });

  it("re-grants execute to authenticated and revokes public, anon and service_role", () => {
    expect(sql).toContain(
      "revoke execute on function public.list_collections(\n  text, text, text, text, text, timestamptz, timestamptz, text, integer, text, text[])\n  from public, anon, service_role;",
    );
    expect(sql).toContain(
      "grant execute on function public.list_collections(\n  text, text, text, text, text, timestamptz, timestamptz, text, integer, text, text[])\n  to authenticated;",
    );
  });
});
