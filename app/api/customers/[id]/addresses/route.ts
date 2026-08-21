import { createCustomerAddress } from "@/_pages/customers/index.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: RouteContext<"/api/customers/[id]/addresses">): Promise<Response> {
  const { id } = await context.params;
  return createCustomerAddress(request, id);
}

