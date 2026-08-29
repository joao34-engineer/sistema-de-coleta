import "server-only";

import { NextResponse } from "next/server";
import { getPublicEnvironment, hasPublicEnvironment } from "@/shared/config/environment";

const SUPABASE_PROBE_TIMEOUT_MS = 2_000;

type CheckStatus = "ok" | "fail";

export type HealthBody = Readonly<{
  ok: boolean;
  status: "ok" | "degraded";
  checks: Readonly<{ app: CheckStatus; supabase: CheckStatus }>;
}>;

async function probeUrl(url: string, headers: Readonly<Record<string, string>>): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { ...headers },
      signal: AbortSignal.timeout(SUPABASE_PROBE_TIMEOUT_MS),
      cache: "no-store",
    });
    // Discard body — never proxy upstream JSON (version, URLs, etc.).
    await response.arrayBuffer().catch(() => undefined);
    return response.ok;
  } catch {
    return false;
  }
}

async function probeSupabase(): Promise<CheckStatus> {
  if (!hasPublicEnvironment()) return "fail";
  const environment = getPublicEnvironment();
  const headers = {
    apikey: environment.supabasePublishableKey,
    Authorization: `Bearer ${environment.supabasePublishableKey}`,
  } as const;
  const authUrl = new URL("/auth/v1/health", environment.supabaseUrl).toString();
  const restUrl = new URL("/rest/v1/", environment.supabaseUrl).toString();
  const [authOk, restOk] = await Promise.all([probeUrl(authUrl, headers), probeUrl(restUrl, headers)]);
  return authOk && restOk ? "ok" : "fail";
}

function healthResponse(body: HealthBody): NextResponse {
  return NextResponse.json(body, {
    status: body.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function getHealth(): Promise<NextResponse> {
  const app: CheckStatus = "ok";
  const supabase = await probeSupabase();
  const ok = app === "ok" && supabase === "ok";
  return healthResponse({
    ok,
    status: ok ? "ok" : "degraded",
    checks: { app, supabase },
  });
}
