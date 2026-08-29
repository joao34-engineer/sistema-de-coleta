/**
 * Local diagnostic for login rate-limit (no secret values printed).
 * Run: npx tsx scripts/diagnose-login-rate-limit.ts
 */
import { createHash, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal(): void {
  const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function classify(key: string): string {
  const value = process.env[key] ?? "";
  if (!value) return "missing";
  if (value.startsWith("eyJ")) return `jwt len=${value.length}`;
  if (value.startsWith("sb_secret_")) return `sb_secret len=${value.length}`;
  if (value.startsWith("sb_publishable_")) return `sb_publishable len=${value.length}`;
  if (value.startsWith("sb_")) return `sb_other len=${value.length}`;
  return `other len=${value.length}`;
}

async function main(): Promise<void> {
  loadEnvLocal();
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "";
  const secret = process.env["SUPABASE_SECRET_KEY"] ?? "";
  const confirm = process.env["SUPABASE_CONFIRM_PROJECT_REF"] ?? "";
  const rateSecret = process.env["DOCUMENT_RATE_LIMIT_SECRET"] ?? "";

  console.log("NEXT_PUBLIC_SUPABASE_URL", classify("NEXT_PUBLIC_SUPABASE_URL").replace(/^other /, "url "));
  console.log("SUPABASE_SECRET_KEY", classify("SUPABASE_SECRET_KEY"));
  console.log("SUPABASE_CONFIRM_PROJECT_REF", classify("SUPABASE_CONFIRM_PROJECT_REF"));
  console.log("DOCUMENT_RATE_LIMIT_SECRET", classify("DOCUMENT_RATE_LIMIT_SECRET"));

  if (!url || !secret || !confirm || rateSecret.length < 32) {
    console.log("RESULT=env_incomplete");
    return;
  }

  const expectedRef = new URL(url).hostname.split(".")[0] ?? "";
  console.log("project_ref_match", confirm === expectedRef ? "yes" : "no");

  const subjectHash = createHmac("sha256", rateSecret)
    .update(`ip:203.0.113.10:diagnose@example.invalid`, "utf8")
    .digest("hex");

  const client = createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await client.rpc("consume_document_rate_limit", {
    p_scope: "auth_login",
    p_subject_hash: subjectHash,
    p_window_seconds: 15 * 60,
    p_limit: 5,
  });

  if (error) {
    console.log("RESULT=rpc_error");
    console.log("rpc_code", error.code ?? "none");
    console.log("rpc_message", error.message);
    console.log("rpc_details", error.details ?? "none");
    console.log("rpc_hint", error.hint ?? "none");
    return;
  }

  console.log("RESULT=ok");
  console.log("rpc_data_type", Array.isArray(data) ? "array" : typeof data);
  console.log("rpc_fingerprint", createHash("sha256").update(JSON.stringify(data)).digest("hex").slice(0, 12));
}

main().catch((error: unknown) => {
  console.log("RESULT=fatal");
  console.log("message", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
