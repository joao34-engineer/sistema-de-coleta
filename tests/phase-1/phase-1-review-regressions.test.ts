import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = process.cwd();
function source(relativePath: string): string {
  return readFileSync(join(repositoryRoot, relativePath), "utf8");
}

function migration(): string {
  return source(join("supabase", "migrations", "20260815090000_phase_1a_collection_core.sql"));
}

function functionBody(sql: string, name: string): string {
  const start = sql.indexOf(`function ${name}`);
  if (start < 0) return "";
  const end = sql.indexOf("\ncreate or replace function", start + 1);
  return sql.slice(start, end < 0 ? undefined : end);
}

function expectDirectFiveHundredResponsesToBeLogged(value: string): void {
  const directResponses = [...value.matchAll(/return respond\(500,[\s\S]{0,120}?\);/g)];
  for (const response of directResponses) {
    const index = response.index ?? 0;
    const context = value.slice(Math.max(0, index - 700), index + response[0].length);
    expect(context).toMatch(/(?:logTransactionFailure|logServerFailure)\(/);
  }
}

describe("Fase 1A reviewer regression gates", () => {
  it("returns the immutable evidence digest in every evidence DTO", () => {
    const model = source("src/_pages/collection-drafts/model/draft.ts");
    const api = source("src/_pages/collection-drafts/api/drafts.server.ts");

    expect(model).toMatch(/EvidenceDTO[\s\S]*?sha256:\s*string/);
    expect(api).toMatch(/function mapEvidence[\s\S]*?sha256:\s*row\.sha256/);
  });

  it("uses the live customer only for drafts and the frozen customer after finalization", () => {
    const sql = migration();
    const listCollections = functionBody(sql, "public.list_collections");
    const collectionDetail = functionBody(sql, "public.get_collection_detail");

    expect(listCollections).toMatch(/collection_record\.status\s*=\s*'draft'[\s\S]{0,500}?customer_record\.legal_name/);
    expect(listCollections).toMatch(/collection_record\.status\s*in\s*\('collected',\s*'canceled'\)[\s\S]{0,500}?customer_snapshot/);
    expect(collectionDetail).toMatch(/collection_record\.status\s*=\s*'draft'[\s\S]{0,500}?customer_record\.legal_name/);
    expect(collectionDetail).toMatch(/customer_snapshot[\s\S]{0,500}?legal_name/);
  });

  it("keeps a pending final-path upload unreadable and permits cleanup without permitting committed deletion", () => {
    const sql = migration();
    const readerPolicy = functionBody(sql, "private.current_user_can_read_storage_object");
    const uploadPolicy = functionBody(sql, "private.current_user_can_upload_intent_path");
    const deletionPolicy = functionBody(sql, "private.current_user_can_delete_upload_intent_path");

    expect(uploadPolicy).toContain("intent_record.status = 'pending'");
    expect(readerPolicy).toMatch(/from public\.evidences[\s\S]*storage_path = p_name/);
    expect(readerPolicy).toMatch(/from public\.signatures[\s\S]*storage_path = p_name/);
    expect(readerPolicy).not.toContain("collection_upload_intents");
    expect(deletionPolicy).toContain("intent_record.status in ('pending', 'canceled', 'expired')");
    expect(deletionPolicy).not.toMatch(/intent_record\.status in \([^)]*committed/);
    expect(deletionPolicy).not.toMatch(/staging/);
  });

  it("does not compensate a storage object after its database commit succeeded but DTO mapping fails", () => {
    const draftApi = source("src/_pages/collection-drafts/api/drafts.server.ts");
    const lifecycleCommands = source("src/_pages/collection-lifecycle/api/commands.ts");

    expect(draftApi).toMatch(/commitSucceeded|uploadCommitted|committedSuccessfully/);
    expect(lifecycleCommands).toMatch(/commitSucceeded|uploadCommitted|committedSuccessfully/);
    expect(draftApi).toMatch(/if\s*\(\s*![^)]*(?:commitSucceeded|uploadCommitted|committedSuccessfully)[^)]*\)\s*await cancelUpload/);
    expect(lifecycleCommands).toMatch(/if\s*\(\s*![^)]*(?:commitSucceeded|uploadCommitted|committedSuccessfully)[^)]*\)\s*await compensateSignatureUpload/);
  });

  it("ships a server-only, idempotent cleanup job for expired staging uploads", () => {
    const cleanupPath = join(repositoryRoot, "scripts", "cleanup-collection-upload-intents.ts");
    expect(existsSync(cleanupPath)).toBe(true);
    const cleanup = readFileSync(cleanupPath, "utf8");

    expect(cleanup).toContain("expire_collection_upload_intents");
    expect(cleanup).toContain("ack_collection_upload_cleanup");
    expect(cleanup).toMatch(/storage\.from\([^)]*\)\.remove/);
    expect(cleanup).toMatch(/logTransactionFailure|logServerFailure/);
  });

  it("creates a customer and its initial address atomically and permits only one primary address", () => {
    const sql = migration();
    const customerApi = source("src/_pages/customers/api/customers.server.ts");

    expect(sql).toMatch(/create(?: unique)? index[\s\S]{0,200}customer_addresses[\s\S]{0,200}where\s+is_primary/i);
    expect(sql).toMatch(/function public\.create_customer_with_address/);
    expect(customerApi).toMatch(/\.rpc\(\s*["']create_customer_with_address["']/);
  });

  it("records a safe failure log before every direct 5xx response", () => {
    const files = [
      "src/_pages/collection-drafts/api/drafts.server.ts",
      "src/_pages/customers/api/customers.server.ts",
      "src/_pages/customers/api/customer-addresses.server.ts",
    ];

    for (const file of files) expectDirectFiveHundredResponsesToBeLogged(source(file));
  });
});
