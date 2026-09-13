import { handleCreateDraft } from "@/_pages/collection-drafts/index.server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request): Promise<Response> { return handleCreateDraft(request); }
