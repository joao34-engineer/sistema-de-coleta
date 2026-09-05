import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260905020000_discard_collection_draft.sql"),
  "utf8",
);

describe("discard_collection_draft RPC contract", () => {
  it("only deletes draft collections and never customers", () => {
    expect(migration).toContain("if collection_record.status <> 'draft'");
    expect(migration).toContain("collection_not_draft");
    expect(migration).toContain("private.current_user_is_admin");
    expect(migration).toContain("delete from public.collection_items");
    expect(migration).toContain("delete from public.collections");
    expect(migration).not.toContain("delete from public.customers");
    expect(migration).toContain("grant execute on function public.discard_collection_draft(uuid, integer)\nto authenticated");
    expect(migration).toContain("revoke execute on function public.discard_collection_draft(uuid, integer)\nfrom public, anon, authenticated, service_role");
  });
});
