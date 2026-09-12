import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("cancel/reopen OS event metadata migration (L10)", () => {
  const sql = readFileSync(
    resolve(__dirname, "../../supabase/migrations/20260912120000_phase_5_cancel_reopen_os_event_metadata.sql"),
    "utf8",
  );

  const reopenFn = sql.slice(
    sql.indexOf("create or replace function public.reopen_collection"),
    sql.indexOf("create or replace function public.cancel_or_reopen_collection"),
  );
  const cancelOrReopenFn = sql.slice(
    sql.indexOf("create or replace function public.cancel_or_reopen_collection"),
  );

  it("replaces both reopen signatures with CREATE OR REPLACE and no DROP FUNCTION", () => {
    expect(sql).toMatch(/create or replace function public\.reopen_collection\(/i);
    expect(sql).toMatch(/create or replace function public\.cancel_or_reopen_collection\(/i);
    expect(sql.match(/create or replace function/gi)).toHaveLength(2);
    expect(sql).not.toMatch(/^\s*drop function/im);
    expect(sql).not.toMatch(/create or replace function public\.deliver_to_customer/i);
  });

  it("re-grants execute on the two public reopen signatures", () => {
    expect(sql).toMatch(
      /grant execute on function public\.reopen_collection\(uuid, integer, text, uuid, text\) to authenticated;/i,
    );
    expect(sql).toMatch(
      /grant execute on function public\.cancel_or_reopen_collection\(uuid, integer, text, text, uuid, text\) to authenticated;/i,
    );
  });

  it("writes serviceOrderPreviousStatus on all three cancel/reopen event inserts", () => {
    expect(reopenFn).toContain("'serviceOrderPreviousStatus'");
    expect(cancelOrReopenFn).toContain("'serviceOrderPreviousStatus'");
    expect((reopenFn.match(/'serviceOrderPreviousStatus'/g) ?? []).length).toBe(1);
    expect((cancelOrReopenFn.match(/'serviceOrderPreviousStatus'/g) ?? []).length).toBe(2);
  });

  it("writes serviceOrderStatus on both reopen event inserts and keeps document metadata on the 5-arg path", () => {
    expect(reopenFn).toContain("'serviceOrderStatus'");
    expect(reopenFn).toContain("'document_id'");
    expect(reopenFn).toContain("'row_version'");
    expect(cancelOrReopenFn).toContain("'serviceOrderStatus'");
    expect((cancelOrReopenFn.match(/'serviceOrderStatus'/g) ?? []).length).toBe(1);
  });
});
