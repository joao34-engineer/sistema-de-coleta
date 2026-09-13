import { handleUploadEvidence } from "@/_pages/collection-drafts/index.server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request, context: RouteContext<"/api/collections/[id]/evidences">): Promise<Response> { const { id } = await context.params; return handleUploadEvidence(request, id); }
