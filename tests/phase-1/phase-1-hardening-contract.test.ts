import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = process.cwd();
const migrationPath = join(repositoryRoot, "supabase", "migrations", "20260815090000_phase_1a_collection_core.sql");

function readRepositoryFile(relativePath: string): string {
  return readFileSync(join(repositoryRoot, relativePath), "utf8");
}

function migrationSql(): string {
  if (!existsSync(migrationPath)) throw new Error("phase_1_migration_missing");
  return readFileSync(migrationPath, "utf8").toLowerCase();
}

function sqlFunction(sql: string, name: string): string {
  const start = sql.indexOf(`function ${name}`);
  if (start < 0) return "";
  const end = sql.indexOf("\ncreate or replace function", start + 1);
  return sql.slice(start, end < 0 ? undefined : end);
}

describe("Fase 1A hardening contract", () => {
  it("keeps legal_name as the canonical customer database field", () => {
    const sql = migrationSql();
    const customerApi = readRepositoryFile("src/_pages/customers/api/customers.server.ts").toLowerCase();
    const databaseTypes = readRepositoryFile("src/shared/api/database.types.ts").toLowerCase();
    const customerStart = sql.indexOf("create table public.customers");
    const contactsStart = sql.indexOf("create table public.customer_contacts");
    const customerTable = customerStart >= 0 && contactsStart > customerStart ? sql.slice(customerStart, contactsStart) : sql;

    expect(sql).toMatch(/create table public\.customers[\s\S]*?legal_name text not null/);
    expect(customerTable).not.toContain("display_name");
    expect(customerApi).toContain("legal_name");
    expect(customerApi).not.toContain("display_name");
    expect(databaseTypes).toMatch(/export type customerrow[\s\S]*?legal_name/);
  });

  it("requires positive versions at every public contract boundary", () => {
    const contracts = readRepositoryFile("src/_pages/collection-lifecycle/model/contracts.ts");
    const draftModel = readRepositoryFile("src/_pages/collection-drafts/model/draft.ts");
    const migration = migrationSql();

    expect(migration).toMatch(/row_version integer not null default 1 check \(row_version > 0\)/);
    expect(contracts).toMatch(/expectedVersion[^\n]*positive\(\)/);
    expect(draftModel).toMatch(/expectedVersion[^\n]*positive\(\)/);
    expect(contracts).not.toMatch(/expectedVersion[^\n]*nonnegative\(\)/);
  });

  it("exposes atomic item and upload commands in the migration", () => {
    const sql = migrationSql();

    for (const functionName of [
      "create_collection_item",
      "update_collection_item",
      "remove_collection_item",
      "prepare_collection_upload",
      "commit_collection_upload",
    ]) {
      expect(sql).toMatch(new RegExp(`create(?: or replace)? function public\\.${functionName}\\b`));
    }
    expect(sql).toMatch(/collection_upload_intents/);
    expect(sql).toMatch(/for update/);
    expect(sql).toMatch(/(?:row_version\s*=\s*(?:row_version|collection_record\.row_version)\s*\+\s*1|next_version\s*:=\s*(?:row_version|collection_record\.row_version)\s*\+\s*1)/);
    expect(sql).toMatch(/row_version\s*=\s*next_version/);
  });

  it("freezes the customer and includes evidence in documentary snapshots", () => {
    const sql = migrationSql();

    expect(sql).toMatch(/customer_snapshot/);
    expect(sql).toMatch(/create(?: or replace)? function private\.collection_snapshot/);
    expect(sql).toMatch(/collection_snapshot[\s\S]*evidences/);
    expect(sql).toMatch(/collection_snapshot[\s\S]*legal_name/);
  });

  it("uses temporal keyset pagination for collection lists and timeline", () => {
    const sql = migrationSql();
    const contracts = readRepositoryFile("src/_pages/collection-lifecycle/model/contracts.ts");
    const eventsRoute = readRepositoryFile("app/api/collections/[id]/events/route.ts");

    expect(sql).toMatch(/order by[\s\S]*created_at desc[\s\S]*id desc/);
    expect(sql).toMatch(/created_at[\s\S]*p_cursor/);
    expect(contracts).toMatch(/cursor\s*:\s*(?:z\.string|cursorSchema)/);
    expect(contracts).not.toMatch(/cursor:\s*uuidSchema/);
    expect(eventsRoute).not.toMatch(/cursor:\s*z\.uuid\(\)/);
  });

  it("has explicit address HTTP routes and idempotency-key error handling", () => {
    const addressCreateRoute = join(repositoryRoot, "app", "api", "customers", "[id]", "addresses", "route.ts");
    const addressPatchRoute = join(repositoryRoot, "app", "api", "customers", "[id]", "addresses", "[addressId]", "route.ts");
    const responseSource = readRepositoryFile("src/_pages/collection-lifecycle/api/http-response.ts");

    expect(existsSync(addressCreateRoute)).toBe(true);
    expect(existsSync(addressPatchRoute)).toBe(true);
    expect(responseSource).toContain("idempotency_key_required");
  });

  it("keeps immutable documentary tables and pending upload objects protected", () => {
    const sql = migrationSql();

    for (const table of ["collection_events", "documents"]) {
      expect(sql).toMatch(new RegExp(`alter table public\\.${table} enable row level security`));
      expect(sql).not.toMatch(new RegExp(`create policy[^;]+on public\\.${table}[^;]+for delete`, "i"));
    }
    expect(sql).toMatch(/collection_upload_intents[\s\S]*expires_at/);
    const uploadPolicy = sqlFunction(sql, "private.current_user_can_upload_intent_path");
    const readerPolicy = sqlFunction(sql, "private.current_user_can_read_storage_object");
    const deletionPolicy = sqlFunction(sql, "private.current_user_can_delete_upload_intent_path");
    expect(uploadPolicy).toContain("intent_record.status = 'pending'");
    expect(readerPolicy).toMatch(/from public\.evidences[\s\S]*storage_path = p_name/);
    expect(readerPolicy).toMatch(/from public\.signatures[\s\S]*storage_path = p_name/);
    expect(readerPolicy).not.toContain("collection_upload_intents");
    expect(deletionPolicy).toContain("intent_record.status in ('pending', 'canceled', 'expired')");
    expect(deletionPolicy).not.toMatch(/staging/);
    expect(sql).toMatch(/create policy[\s\S]{0,300}on storage\.objects for delete[\s\S]{0,500}current_user_can_delete_upload_intent_path/i);
  });
});
