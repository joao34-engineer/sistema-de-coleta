import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260905133628_signature_storage_delivery_intent_definer.sql"),
  "utf8",
);

const insertPolicy = migration.slice(
  migration.indexOf("create policy collection_signatures_insert_delivery_intent"),
  migration.indexOf("drop policy if exists collection_signatures_read_delivery_or_checkin"),
);

const selectPolicy = migration.slice(migration.indexOf("create policy collection_signatures_read_delivery_or_checkin"));

describe("signature Storage delivery-intent DEFINER contract", () => {
  it("wraps private intent tables in SECURITY DEFINER helpers", () => {
    expect(migration).toContain("grant usage on schema private to authenticated");
    expect(migration).toContain("create or replace function private.current_user_can_upload_delivery_intent_path(");
    expect(migration).toContain("create or replace function private.current_user_can_read_committed_private_signature_path(");
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain("grant execute on function");
    expect(migration).not.toMatch(/grant\s+select\s+on\s+table\s+private\.(delivery_signature_intents|collection_upload_intents)/i);
  });

  it("keeps collection draft INSERT on the existing helper and delivery INSERT on the new helper only", () => {
    expect(migration).not.toContain("create policy collection_signatures_insert_draft_admin");
    expect(insertPolicy).toContain("private.current_user_can_upload_delivery_intent_path(");
    expect(insertPolicy).not.toContain("private.current_user_can_upload_intent_path(");
    expect(insertPolicy).not.toContain("from private.delivery_signature_intents");
    expect(insertPolicy).not.toContain("metadata->>'mimetype'");
  });

  it("removes raw private-table EXISTS from the SELECT policy", () => {
    expect(selectPolicy).toContain("private.current_user_can_read_committed_private_signature_path(");
    expect(selectPolicy).not.toContain("from private.delivery_signature_intents");
    expect(selectPolicy).not.toContain("from private.collection_upload_intents");
    expect(selectPolicy).toContain("from public.signatures");
  });
});
