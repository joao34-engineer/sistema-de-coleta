import { handlePatchCustomerAddress } from "@/_pages/customers/index.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: RouteContext<"/api/customers/[id]/addresses/[addressId]">): Promise<Response> {
  const { id, addressId } = await context.params;
  return handlePatchCustomerAddress(request, id, addressId);
}
