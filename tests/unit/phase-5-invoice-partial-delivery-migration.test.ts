import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("invoice partial-delivery migration (L2)", () => {
  const sql = readFileSync(
    resolve(__dirname, "../../supabase/migrations/20260907030000_phase_5_invoice_partial_delivery.sql"),
    "utf8",
  );

  it("replaces the three existing signatures with CREATE OR REPLACE and no DROP FUNCTION", () => {
    expect(sql).toMatch(/create or replace function public\.register_invoice_reference\(/i);
    expect(sql).toMatch(/create or replace function public\.deliver_to_customer\(/i);
    expect(sql).toMatch(/create or replace function public\.update_service_progress\(/i);
    expect(sql.match(/create or replace function/gi)).toHaveLength(3);
    expect(sql).not.toMatch(/^\s*drop function/im);
  });

  it("does not emit GRANT statements", () => {
    expect(sql).not.toMatch(/^\s*grant\b/im);
  });

  it("accepts NF-e on ready or partial_delivery and records the real previous_status", () => {
    const invoiceFn = sql.slice(
      sql.indexOf("create or replace function public.register_invoice_reference"),
      sql.indexOf("create or replace function public.deliver_to_customer"),
    );
    expect(invoiceFn).toContain("('ready', 'partial_delivery')");
    expect(invoiceFn).toContain("errcode = 'P0001', message = 'collection_not_ready'");
    expect(invoiceFn).toContain("'collection.invoice.registered', collection_record.status, 'invoiced'");
    expect(invoiceFn).not.toContain("'collection.invoice.registered', 'ready', 'invoiced'");
  });

  it("keeps invoiced when remaining items exist after delivery", () => {
    const deliverFn = sql.slice(
      sql.indexOf("create or replace function public.deliver_to_customer"),
      sql.indexOf("create or replace function public.update_service_progress"),
    );
    expect(deliverFn).toContain("when remaining = 0 then 'delivered'");
    expect(deliverFn).toContain("when collection_record.status = 'invoiced' then 'invoiced'");
    expect(deliverFn).toContain("and organization_id = collection_record.organization_id");
    expect(deliverFn).not.toMatch(/service_order_record public\.service_orders%rowtype/);
  });

  it("accepts invoiced on progress, does not yank it to ready, and stamps updated_at", () => {
    const progressFn = sql.slice(sql.indexOf("create or replace function public.update_service_progress"));
    expect(progressFn).toContain("('approved', 'in_service', 'partial_delivery', 'invoiced')");
    expect(progressFn).toContain("collection_record.status in ('partial_delivery', 'invoiced')");
    expect(progressFn).toContain("updated_at = now()");
    const writeLoop = progressFn.slice(
      progressFn.indexOf("for item_record in select * from jsonb_to_recordset"),
      progressFn.indexOf("end loop;"),
    );
    expect(writeLoop.indexOf("item_already_delivered")).toBeLessThan(writeLoop.indexOf("update public.service_order_items"));
  });
});
