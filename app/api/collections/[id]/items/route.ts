import { handleAddDraftItem } from "@/_pages/collection-drafts/index.server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request, context: RouteContext<"/api/collections/[id]/items">): Promise<Response> { const { id } = await context.params; return handleAddDraftItem(request, id); }
