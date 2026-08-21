import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type PhaseOneRemoteConfig = Readonly<{
  baseUrl: string;
  bearerToken: string;
  bearerTokenB: string | null;
  supabaseUrl: string | null;
  publishableKey: string | null;
  organizationId: string | null;
  organizationIdB: string | null;
  fullScenarios: boolean;
}>;

function optionalEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function isUnsafeTarget(baseUrl: string): boolean {
  const configuredAppUrl = optionalEnv("NEXT_PUBLIC_APP_URL");
  const configuredSupabaseUrl = optionalEnv("NEXT_PUBLIC_SUPABASE_URL");
  return baseUrl === configuredAppUrl || baseUrl === configuredSupabaseUrl;
}

function loadConfig(): Readonly<{ config: PhaseOneRemoteConfig | null; error: string | null }> {
  const baseUrl = optionalEnv("PHASE_1_QA_BASE_URL");
  const bearerToken = optionalEnv("PHASE_1_QA_BEARER_TOKEN");
  const marker = optionalEnv("PHASE_1_QA_ENVIRONMENT");
  const anyRemoteVariable = Boolean(baseUrl || bearerToken || marker);

  if (!baseUrl && !bearerToken && !marker) return { config: null, error: null };
  if (!baseUrl || !bearerToken || marker !== "isolated") {
    return { config: null, error: "phase_1_qa_requires_isolated_marker_and_base_credentials" };
  }
  if (isUnsafeTarget(baseUrl)) {
    return { config: null, error: "phase_1_qa_target_matches_application_supabase_url" };
  }
  if (!anyRemoteVariable) return { config: null, error: null };

  return {
    config: {
      baseUrl: baseUrl.replace(/\/$/, ""),
      bearerToken,
      bearerTokenB: optionalEnv("PHASE_1_QA_BEARER_TOKEN_B"),
      supabaseUrl: optionalEnv("PHASE_1_QA_SUPABASE_URL"),
      publishableKey: optionalEnv("PHASE_1_QA_PUBLISHABLE_KEY"),
      organizationId: optionalEnv("PHASE_1_QA_ORGANIZATION_ID"),
      organizationIdB: optionalEnv("PHASE_1_QA_ORGANIZATION_ID_B"),
      fullScenarios: optionalEnv("PHASE_1_QA_FULL_SCENARIOS") === "1",
    },
    error: null,
  };
}

const loaded = loadConfig();
export const remoteConfig = loaded.config;
export const remoteConfigError = loaded.error;
export const remoteEnabled = remoteConfig !== null;
export const fullRemoteEnabled = remoteConfig !== null && remoteConfig.fullScenarios;
export const rlsRemoteEnabled = Boolean(
  remoteConfig?.bearerTokenB && remoteConfig.organizationId && remoteConfig.organizationIdB,
);
export const storageInspectionEnabled = Boolean(
  remoteConfig?.supabaseUrl && remoteConfig.publishableKey && remoteConfig.organizationId,
);

export type JsonRequestInit = RequestInit & Readonly<{
  token?: string | undefined;
}>;

export function apiUrl(path: string): string {
  if (!remoteConfig) throw new Error(remoteConfigError ?? "phase_1_qa_not_configured");
  return `${remoteConfig.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function apiRequest(path: string, init: JsonRequestInit = {}): Promise<Response> {
  const { token, headers, ...requestInit } = init;
  const requestHeaders = new Headers(headers);
  requestHeaders.set("Accept", "application/json");
  requestHeaders.set("Authorization", `Bearer ${token ?? remoteConfig?.bearerToken ?? ""}`);
  return fetch(apiUrl(path), {
    ...requestInit,
    headers: requestHeaders,
    cache: "no-store",
  });
}

export function jsonRequest(body: unknown, init: JsonRequestInit = {}): JsonRequestInit {
  return {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
    body: JSON.stringify(body),
  };
}

export async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export function asRecord(value: unknown): Readonly<Record<string, unknown>> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : null;
}

export function responseErrorCode(value: unknown): string | null {
  const body = asRecord(value);
  const nestedError = asRecord(body?.["error"]);
  const code = nestedError?.["code"] ?? body?.["code"];
  return typeof code === "string" ? code : null;
}

export function responseData(value: unknown): Readonly<Record<string, unknown>> | null {
  const body = asRecord(value);
  return asRecord(body?.["data"]);
}

export function responseField(value: unknown, field: string): unknown {
  return asRecord(value)?.[field];
}

export function recordString(value: unknown, field: string): string | null {
  const result = responseField(value, field);
  return typeof result === "string" ? result : null;
}

export function recordNumber(value: unknown, field: string): number | null {
  const result = responseField(value, field);
  return typeof result === "number" ? result : null;
}

export function createRlsClient(token: string): SupabaseClient | null {
  if (!remoteConfig?.supabaseUrl || !remoteConfig.publishableKey) return null;
  return createClient(remoteConfig.supabaseUrl, remoteConfig.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

export async function listStoragePrefix(
  token: string,
  bucket: "collection-evidences" | "collection-signatures",
  prefix: string,
): Promise<Readonly<{ data: ReadonlyArray<Readonly<{ name: string }>> | null; error: unknown }>> {
  const client = createRlsClient(token);
  if (!client) return { data: null, error: new Error("storage_inspection_not_configured") };
  const result = await client.storage.from(bucket).list(prefix, { limit: 100 });
  return { data: result.data, error: result.error };
}

export function assertRemoteConfiguration(): void {
  if (remoteConfigError) throw new Error(remoteConfigError);
  if (!remoteConfig) throw new Error("phase_1_qa_not_configured");
}
