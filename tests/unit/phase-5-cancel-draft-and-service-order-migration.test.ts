import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("cancel draft and service order migration (PR 4)", () => {
  const sql = readFileSync(
    resolve(__dirname, "../../supabase/migrations/20260907010000_phase_5_cancel_draft_and_service_order.sql"),
    "utf8",
  );

  const reopenFn = sql.slice(
    sql.indexOf("create or replace function public.reopen_collection"),
    sql.indexOf("create or replace function public.cancel_or_reopen_collection"),
  );
  const cancelOrReopenFn = sql.slice(sql.indexOf("create or replace function public.cancel_or_reopen_collection"));

  it("replaces both reopen signatures with CREATE OR REPLACE and no DROP FUNCTION", () => {
    expect(sql).toMatch(/create or replace function public\.reopen_collection\(/i);
    expect(sql).toMatch(/create or replace function public\.cancel_or_reopen_collection\(/i);
    expect(sql.match(/create or replace function/gi)).toHaveLength(2);
    expect(sql).not.toMatch(/^\s*drop function/im);
  });

  it("re-grants execute on the public reopen signatures", () => {
    expect(sql).toMatch(
      /grant execute on function public\.reopen_collection\(uuid, integer, text, uuid, text\) to authenticated;/i,
    );
    expect(sql).toMatch(
      /grant execute on function public\.cancel_or_reopen_collection\(uuid, integer, text, text, uuid, text\) to authenticated;/i,
    );
  });

  it("adds previous_status_before_cancellation with a CHECK of every OS status except canceled", () => {
    expect(sql).toMatch(/alter table public\.service_orders/i);
    expect(sql).toContain("add column if not exists previous_status_before_cancellation text");
    expect(sql).toContain("service_orders_previous_status_before_cancellation_check");
    expect(sql).toContain("'draft', 'budgeted', 'approved', 'in_service', 'ready', 'rejected', 'delivered'");
    expect(sql).not.toMatch(/previous_status_before_cancellation in \([^)]*'canceled'/);
  });

  it("refuses draft cancel before the collections UPDATE", () => {
    expect(cancelOrReopenFn).toContain("message = 'collection_not_cancelable_draft'");
    expect(cancelOrReopenFn.indexOf("collection_not_cancelable_draft")).toBeLessThan(
      cancelOrReopenFn.indexOf("set status = 'canceled'"),
    );
  });

  it("restores service_orders.status from previous_status_before_cancellation on both reopen paths", () => {
    for (const body of [reopenFn, cancelOrReopenFn]) {
      expect(body).toContain("restored_os_status := service_order_record.previous_status_before_cancellation");
      expect(body).toContain("set status = restored_os_status");
      expect(body).toContain("previous_status_before_cancellation = null");
    }
  });
});
