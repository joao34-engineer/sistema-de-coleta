import { handleGetDraft, handlePatchDraft } from "@/_pages/collection-drafts/index.server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: RouteContext<"/api/collections/[id]/draft">): Promise<Response> { const { id } = await context.params; return handleGetDraft(id, request); }
export async function PATCH(request: Request, context: RouteContext<"/api/collections/[id]/draft">): Promise<Response> { const { id } = await context.params; return handlePatchDraft(request, id); }
