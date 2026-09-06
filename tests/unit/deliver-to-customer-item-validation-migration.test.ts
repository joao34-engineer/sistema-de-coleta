import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("deliver_to_customer item validation migration (5.5)", () => {
  const sql = readFileSync(
    resolve(__dirname, "../../supabase/migrations/20260906170000_phase_5_deliver_to_customer_item_validation.sql"),
    "utf8",
  );

  it("replaces the same 9-argument signature without DROP FUNCTION", () => {
    expect(sql).toMatch(/create or replace function public\.deliver_to_customer\(/i);
    expect(sql).not.toMatch(/^\s*drop function/im);
    expect(sql).toContain("p_collection_id uuid");
    expect(sql).toContain("p_expected_version integer");
    expect(sql).toContain("p_delivered_item_ids uuid[]");
    expect(sql).toContain("p_receiver_name text");
    expect(sql).toContain("p_receiver_tax_id text");
    expect(sql).toContain("p_notes text");
    expect(sql).toContain("p_signature_intent_id uuid");
    expect(sql).toContain("p_idempotency_key uuid");
    expect(sql).toContain("p_request_hash text");
  });

  it("adds duplicate and already-delivered guards before the item loop", () => {
    const guardsIndex = sql.indexOf("duplicate_delivery_item");
    const alreadyIndex = sql.indexOf("item_already_delivered");
    const loopIndex = sql.indexOf("for item in select unnest(p_delivered_item_ids)");
    expect(guardsIndex).toBeGreaterThan(0);
    expect(alreadyIndex).toBeGreaterThan(guardsIndex);
    expect(loopIndex).toBeGreaterThan(alreadyIndex);
    expect(sql).not.toMatch(/^\s*(create unique index|alter table public\.delivery_items)/im);
  });

  it("still sets the service order to delivered when remaining = 0", () => {
    expect(sql).toContain("set status = case when remaining = 0 then 'delivered' else 'ready' end");
    expect(sql).toContain("next_status := case when remaining = 0 then 'delivered' else 'partial_delivery' end");
  });
});
