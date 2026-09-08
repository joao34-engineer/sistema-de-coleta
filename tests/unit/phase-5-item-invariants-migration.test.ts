import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("item invariants migration (L4)", () => {
  const sql = readFileSync(
    resolve(__dirname, "../../supabase/migrations/20260907230000_phase_5_item_invariants.sql"),
    "utf8",
  );

  const budgetFn = sql.slice(
    sql.indexOf("create or replace function public.create_technical_budget"),
    sql.indexOf("create or replace function public.deliver_to_customer"),
  );
  const deliverFn = sql.slice(
    sql.indexOf("create or replace function public.deliver_to_customer"),
    sql.indexOf("create or replace function public.update_service_progress"),
  );
  const progressFn = sql.slice(sql.indexOf("create or replace function public.update_service_progress"));

  it("replaces the three existing signatures with CREATE OR REPLACE and no DROP FUNCTION", () => {
    expect(sql).toMatch(/create or replace function public\.create_technical_budget\(/i);
    expect(sql).toMatch(/create or replace function public\.deliver_to_customer\(/i);
    expect(sql).toMatch(/create or replace function public\.update_service_progress\(/i);
    expect(sql.match(/create or replace function/gi)).toHaveLength(5);
    expect(sql).not.toMatch(/^\s*drop function/im);
  });

  it("does not emit GRANT statements", () => {
    expect(sql).not.toMatch(/^\s*grant\b/im);
  });

  it("fails closed on duplicate service_order_items then creates the partial unique index", () => {
    expect(sql).toContain("duplicate_service_order_items_exist");
    expect(sql).toMatch(
      /create unique index if not exists service_order_items_collection_item_uidx/i,
    );
    expect(sql).toContain("where collection_item_id is not null");
    expect(sql).not.toMatch(/create\s+unique\s+index\s+concurrently/i);
  });

  it("defines remaining helpers that require an OS line and exclude delivered items", () => {
    expect(sql).toMatch(/create or replace function private\.count_remaining_deliverable_items\(/i);
    expect(sql).toMatch(/create or replace function private\.any_remaining_in_repair\(/i);
    const helpers = sql.slice(0, sql.indexOf("create or replace function public.create_technical_budget"));
    expect(helpers).toContain("and soi.collection_item_id = ci.id");
    expect(helpers).toContain("from public.delivery_items as di");
    expect(helpers).not.toMatch(/id not in \(/);
  });

  it("rejects duplicate budget item ids before inserting service_order_items", () => {
    expect(budgetFn).toContain("duplicate_budget_item");
    expect(budgetFn.indexOf("duplicate_budget_item")).toBeLessThan(
      budgetFn.indexOf("insert into public.service_order_items"),
    );
  });

  it("raises collection_item_not_found before item_not_ready and requires every OS row pronto", () => {
    expect(deliverFn.indexOf("collection_item_not_found")).toBeLessThan(
      deliverFn.indexOf("errcode = 'P0001', message = 'item_not_ready'"),
    );
    expect(deliverFn).toContain("and soi.status is distinct from 'pronto'");
    expect(deliverFn.indexOf("item_not_ready")).toBeLessThan(
      deliverFn.lastIndexOf("insert into public.delivery_items"),
    );
  });

  it("counts remaining via helpers and keeps invoiced when items remain", () => {
    expect(deliverFn).toContain("private.count_remaining_deliverable_items(");
    expect(deliverFn).toContain("private.any_remaining_in_repair(");
    expect(deliverFn).toContain("when remaining = 0 then 'delivered'");
    expect(deliverFn).toContain("when collection_record.status = 'invoiced' then 'invoiced'");
    expect(deliverFn).toContain("'remainingInRepairItemIds'");
    expect(deliverFn).toContain("'serviceOrderStatus'");
  });

  it("aggregates progress without orphan null collection_item_id rows", () => {
    expect(progressFn).toContain("and soi.collection_item_id is not null");
    expect(progressFn).not.toContain("collection_item_id is null\n      or");
    expect(progressFn).toContain("collection_record.status in ('partial_delivery', 'invoiced')");
  });
});
