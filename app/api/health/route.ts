import { getHealth } from "@/_app/api-routes/health";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return getHealth();
}

export async function HEAD(): Promise<Response> {
  const response = await getHealth();
  return new Response(null, { status: response.status, headers: response.headers });
}
