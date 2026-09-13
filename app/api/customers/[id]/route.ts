import { handleGetCustomer, handlePatchCustomer } from "@/_pages/customers/index.server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: RouteContext<"/api/customers/[id]">): Promise<Response> { const { id } = await context.params; return handleGetCustomer(id, request); }
export async function PATCH(request: Request, context: RouteContext<"/api/customers/[id]">): Promise<Response> { const { id } = await context.params; return handlePatchCustomer(request, id); }
