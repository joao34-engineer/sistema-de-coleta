import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("workshop check-in missing migration (PR 5)", () => {
  const sql = readFileSync(
    resolve(__dirname, "../../supabase/migrations/20260912100000_phase_5_workshop_check_in_missing.sql"),
    "utf8",
  );

  const helpers = sql.slice(0, sql.indexOf("create or replace function public.workshop_check_in"));
  const checkInFn = sql.slice(
    sql.indexOf("create or replace function public.workshop_check_in"),
    sql.indexOf("create or replace function public.create_technical_budget"),
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

  it("replaces existing signatures with CREATE OR REPLACE and no DROP FUNCTION", () => {
    expect(sql).toMatch(/create or replace function public\.workshop_check_in\(/i);
    expect(sql).toMatch(/create or replace function public\.create_technical_budget\(/i);
    expect(sql).toMatch(/create or replace function public\.deliver_to_customer\(/i);
    expect(sql).toMatch(/create or replace function public\.update_service_progress\(/i);
    expect(sql.match(/create or replace function/gi)).toHaveLength(6);
    expect(sql).not.toMatch(/^\s*drop function/im);
  });

  it("does not emit GRANT statements", () => {
    expect(sql).not.toMatch(/^\s*grant\b/im);
  });

  it("adds arrival_status, compound CHECK and unique on workshop_checkin_items", () => {
    expect(sql).toContain("add column if not exists arrival_status text not null default 'arrived'");
    expect(sql).toContain("workshop_checkin_items_arrival_status_check");
    expect(sql).toContain("workshop_checkin_items_arrival_invariant_check");
    expect(sql).toContain("condition_observed = 'nao_recebido'");
    expect(sql).toMatch(/create unique index if not exists workshop_checkin_items_collection_item_uidx/i);
  });

  it("excludes missing check-in rows from remaining helpers via EXISTS", () => {
    expect(helpers).toContain("from public.workshop_checkin_items as wci");
    expect(helpers).toContain("and wci.arrival_status = 'missing'");
    expect(helpers).not.toMatch(/join public\.workshop_checkin_items/i);
  });

  it("reads arrival_status from jsonb and jumps to delivered when every item is missing", () => {
    expect(checkInFn).toContain("arrival_status text");
    expect(checkInFn).toContain("observed_condition := 'nao_recebido'");
    expect(checkInFn).toContain("when arrived_count = 0 then 'delivered'");
    expect(checkInFn).toContain("'missingItemIds'");
    expect(checkInFn).toContain("'administratorName'");
  });

  it("raises item_not_received after membership in budget, delivery and progress", () => {
    expect(budgetFn.indexOf("collection_item_not_found")).toBeLessThan(budgetFn.indexOf("item_not_received"));
    expect(budgetFn.indexOf("item_not_received")).toBeLessThan(budgetFn.indexOf("insert into public.service_order_items"));
    expect(deliverFn.indexOf("collection_item_not_found")).toBeLessThan(deliverFn.indexOf("item_not_received"));
    expect(deliverFn.indexOf("item_not_received")).toBeLessThan(deliverFn.indexOf("item_not_ready"));
    expect(progressFn).toContain("item_not_received");
  });
});
