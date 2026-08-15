import { removeItem } from "@/_pages/collection-drafts/api/drafts.server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request, context: RouteContext<"/api/collections/[id]/items/[itemId]/remove">): Promise<Response> { const { id, itemId } = await context.params; return removeItem(request, id, itemId); }
