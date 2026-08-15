import { patchItem } from "@/_pages/collection-drafts/api/drafts.server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function PATCH(request: Request, context: RouteContext<"/api/collections/[id]/items/[itemId]">): Promise<Response> { const { id, itemId } = await context.params; return patchItem(request, id, itemId); }
