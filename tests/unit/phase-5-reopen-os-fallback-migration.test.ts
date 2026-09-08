import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("reopen OS fallback migration (L6)", () => {
  const sql = readFileSync(
    resolve(__dirname, "../../supabase/migrations/20260907240000_phase_5_reopen_os_fallback.sql"),
    "utf8",
  );

  const helperFn = sql.slice(
    sql.indexOf("create or replace function private.service_order_status_from_remaining"),
    sql.indexOf("create or replace function public.reopen_collection"),
  );
  const reopenFn = sql.slice(
    sql.indexOf("create or replace function public.reopen_collection"),
    sql.indexOf("create or replace function public.cancel_or_reopen_collection"),
  );
  const cancelOrReopenFn = sql.slice(
    sql.indexOf("create or replace function public.cancel_or_reopen_collection"),
    sql.indexOf("create or replace function public.deliver_to_customer"),
  );
  const deliverFn = sql.slice(sql.indexOf("create or replace function public.deliver_to_customer"));

  it("replaces the existing signatures with CREATE OR REPLACE and no DROP FUNCTION", () => {
    expect(sql).toMatch(/create or replace function private\.service_order_status_from_remaining\(/i);
    expect(sql).toMatch(/create or replace function public\.reopen_collection\(/i);
    expect(sql).toMatch(/create or replace function public\.cancel_or_reopen_collection\(/i);
    expect(sql).toMatch(/create or replace function public\.deliver_to_customer\(/i);
    expect(sql.match(/create or replace function/gi)).toHaveLength(4);
    expect(sql).not.toMatch(/^\s*drop function/im);
  });

  it("re-grants execute on the two public reopen RPCs and not on the private helper", () => {
    expect(sql).toMatch(
      /grant execute on function public\.reopen_collection\(uuid, integer, text, uuid, text\) to authenticated;/i,
    );
    expect(sql).toMatch(
      /grant execute on function public\.cancel_or_reopen_collection\(uuid, integer, text, text, uuid, text\) to authenticated;/i,
    );
    expect(helperFn).not.toMatch(/^\s*grant\b/im);
  });

  it("derives OS status from L4 remaining helpers", () => {
    expect(helperFn).toContain("private.count_remaining_deliverable_items(");
    expect(helperFn).toContain("private.any_remaining_in_repair(");
    expect(helperFn).toContain("when private.count_remaining_deliverable_items(p_organization_id, p_collection_id) = 0");
    expect(helperFn).toContain("then 'delivered'");
    expect(helperFn).toContain("then 'in_service'");
    expect(helperFn).toContain("else 'ready'");
  });

  it("maps awaiting_approval to budgeted and never flattens partial_delivery or invoiced to ready", () => {
    for (const body of [reopenFn, cancelOrReopenFn]) {
      expect(body).toContain("when 'awaiting_approval' then 'budgeted'");
      expect(body).toContain("when 'partial_delivery' then");
      expect(body).toContain("when 'invoiced' then");
      expect(body).toContain("private.service_order_status_from_remaining(");
      expect(body).not.toContain("when 'partial_delivery' then 'ready'");
      expect(body).not.toContain("when 'invoiced' then 'ready'");
    }
  });

  it("raises service_order_reopen_status_unknown instead of leaving the OS canceled", () => {
    for (const body of [reopenFn, cancelOrReopenFn]) {
      expect(body).toContain("message = 'service_order_reopen_status_unknown'");
      expect(body.indexOf("service_order_reopen_status_unknown")).toBeLessThan(
        body.lastIndexOf("update public.service_orders"),
      );
      expect(body).not.toMatch(/if restored_os_status is not null then/);
    }
  });

  it("uses the remaining helper for deliver_to_customer next_os_status", () => {
    expect(deliverFn).toContain("next_os_status := private.service_order_status_from_remaining(");
    expect(deliverFn).not.toContain("when any_remaining_in_repair then 'in_service'");
    expect(deliverFn).toContain("when collection_record.status = 'invoiced' then 'invoiced'");
  });
});
