import { getDraft, patchDraft } from "@/_pages/collection-drafts/api/drafts.server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: RouteContext<"/api/collections/[id]/draft">): Promise<Response> { const { id } = await context.params; return getDraft(id, request); }
export async function PATCH(request: Request, context: RouteContext<"/api/collections/[id]/draft">): Promise<Response> { const { id } = await context.params; return patchDraft(request, id); }
