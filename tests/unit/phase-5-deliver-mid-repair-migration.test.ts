import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("deliver mid-repair migration (phase 5)", () => {
  const sql = readFileSync(
    resolve(__dirname, "../../supabase/migrations/20260907000000_phase_5_deliver_mid_repair.sql"),
    "utf8",
  );

  it("replaces the three existing signatures with CREATE OR REPLACE and no DROP FUNCTION", () => {
    expect(sql).toMatch(/create or replace function public\.deliver_to_customer\(/i);
    expect(sql).toMatch(/create or replace function private\.prepare_delivery_signature_intent\(/i);
    expect(sql).toMatch(/create or replace function public\.update_service_progress\(/i);
    expect(sql.match(/create or replace function/gi)).toHaveLength(3);
    expect(sql).not.toMatch(/^\s*drop function/im);
  });

  it("does not emit GRANT statements", () => {
    expect(sql).not.toMatch(/^\s*grant\b/im);
  });

  it("widens the deliverable collection-status set and raises item_not_ready", () => {
    expect(sql).toContain("('in_service', 'ready', 'invoiced', 'partial_delivery')");
    expect(sql).toContain("errcode = 'P0001', message = 'item_not_ready'");
    expect(sql).toContain("when remaining = 0 then 'delivered'");
    expect(sql).toContain("when any_remaining_in_repair then 'in_service'");
  });
});
