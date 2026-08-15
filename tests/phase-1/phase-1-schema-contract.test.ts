import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDirectory = join(process.cwd(), "supabase", "migrations");
const migrationPaths = existsSync(migrationsDirectory)
  ? readdirSync(migrationsDirectory)
      .filter((name) => name.endsWith(".sql"))
      .map((name) => join(migrationsDirectory, name))
  : [];

const phaseOneMigrationPath = migrationPaths.find((path) =>
  readFileSync(path, "utf8").includes("create table public.customers"),
);

function migrationSql(): string {
  if (!phaseOneMigrationPath) throw new Error("phase_1_migration_missing");
  return readFileSync(phaseOneMigrationPath, "utf8").toLowerCase();
}

describe.skipIf(!phaseOneMigrationPath)("Fase 1A migration contract", () => {
  it("creates every operational entity as an additive, organization-scoped model", () => {
    const sql = migrationSql();

    for (const table of [
      "customers",
      "customer_contacts",
      "customer_addresses",
      "vehicles",
      "collections",
      "collection_items",
      "evidences",
      "signatures",
      "collection_sequences",
      "collection_events",
      "documents",
      "idempotency_requests",
    ]) {
      expect(sql).toContain(`create table public.${table}`);
    }

    expect(sql).toMatch(/create table public\.collections[\s\S]*?organization_id/);
    expect(sql).toMatch(/create table public\.collections[\s\S]*?row_version/);
    expect(sql).toMatch(/create table public\.collections[\s\S]*?check[\s\S]*?(draft|collected|canceled)/);
    expect(sql).toMatch(/unique[\s\S]*?organization_id[\s\S]*?(official_code|code)/);
  });

  it("enforces immutable documentary records and scoped row-level security", () => {
    const sql = migrationSql();

    for (const table of ["collections", "collection_items", "evidences", "signatures", "collection_events", "documents"]) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
    }

    for (const table of ["signatures", "collection_events", "documents"]) {
      expect(sql).not.toMatch(new RegExp(`create policy[^;]+on public\\.${table}[^;]+for delete`, "i"));
    }

    expect(sql).toMatch(/create policy[\s\S]*?on storage\.objects[\s\S]*?(evidence|signature)/);
    expect(sql).not.toMatch(/create policy[^;]+on storage\.objects[^;]+for delete/i);
  });

  it("hardens the transactional commands and official sequence", () => {
    const sql = migrationSql();

    expect(sql).toMatch(/create(?:\s+or\s+replace)?\s+function[\s\S]*?(finalize|finalise)_collection/);
    expect(sql).toMatch(/for update/);
    expect(sql).toMatch(/idempotency/);
    expect(sql).toMatch(/america\/sao_paulo/);
    expect(sql).toMatch(/mjt-/);
    expect(sql).toMatch(/digest\s*\(/);
    expect(sql).toMatch(/security definer[\s\S]*?set search_path\s*=\s*''/);
    expect(sql).toMatch(/revoke all[\s\S]*?from public/);
  });
});
