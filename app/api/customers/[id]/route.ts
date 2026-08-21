import { getCustomer, patchCustomer } from "@/_pages/customers/api/customers.server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: RouteContext<"/api/customers/[id]">): Promise<Response> { const { id } = await context.params; return getCustomer(id, request); }
export async function PATCH(request: Request, context: RouteContext<"/api/customers/[id]">): Promise<Response> { const { id } = await context.params; return patchCustomer(request, id); }
