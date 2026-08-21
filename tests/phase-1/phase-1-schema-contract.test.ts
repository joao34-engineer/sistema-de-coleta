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

type StoragePolicy = Readonly<{ name: string; operation: string; statement: string }>;

function storageObjectPolicies(sql: string): StoragePolicy[] {
  return [...sql.matchAll(/create\s+policy\b[\s\S]*?;/gi)].flatMap((match) => {
    const statement = match[0];
    if (!/\bon\s+storage\.objects\b/i.test(statement)) return [];

    const name = statement.match(/create\s+policy\s+([a-z0-9_]+)/i)?.[1];
    const operation = statement.match(/\bfor\s+(all|select|insert|update|delete)\b/i)?.[1]?.toLowerCase();
    if (!name || !operation) return [];
    return [{ name, operation, statement }];
  });
}

function policyRoles(statement: string): string[] {
  const roles = statement.match(/\bto\s+([a-z0-9_,\s]+?)(?=\s+(?:using|with\s+check)|\s*;)/i)?.[1];
  return roles ? roles.split(",").map((role) => role.trim()).filter(Boolean) : [];
}

function bucketIds(statement: string): string[] {
  return [...statement.matchAll(/\bbucket_id\s*=\s*'([^']+)'/gi)]
    .map((match) => match[1])
    .filter((bucket): bucket is string => typeof bucket === "string");
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

    const deleteCapablePolicies = storageObjectPolicies(sql).filter(
      ({ operation }) => operation === "delete" || operation === "all",
    );
    const expectedDeletePolicies = [
      { name: "collection_evidences_delete_unconfirmed_intent", bucket: "collection-evidences" },
      { name: "collection_signatures_delete_unconfirmed_intent", bucket: "collection-signatures" },
    ];

    expect(deleteCapablePolicies.map(({ name }) => name).sort()).toEqual(
      expectedDeletePolicies.map(({ name }) => name).sort(),
    );

    for (const expectedPolicy of expectedDeletePolicies) {
      const policy = deleteCapablePolicies.find(({ name }) => name === expectedPolicy.name);
      expect(policy).toBeDefined();
      if (!policy) continue;

      expect(policy.operation).toBe("delete");
      expect(policyRoles(policy.statement)).toEqual(["authenticated"]);
      expect(bucketIds(policy.statement)).toEqual([expectedPolicy.bucket]);
      expect(policy.statement).toContain("private.current_user_can_delete_upload_intent_path");
      expect(policy.statement).toMatch(/\busing\s*\(/i);
      expect(policy.statement).not.toMatch(/\b(?:public|anon)\b/i);
      expect(policy.statement).not.toMatch(/collection-documents/i);
    }

    expect(sql).toMatch(
      /create(?:\s+or\s+replace)?\s+function\s+private\.current_user_can_delete_upload_intent_path[\s\S]*?intent_record\.status\s+in\s*\(\s*'pending'\s*,\s*'canceled'\s*,\s*'expired'\s*\)/i,
    );
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
