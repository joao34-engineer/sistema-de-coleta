import { createDraft } from "@/_pages/collection-drafts/api/drafts.server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request): Promise<Response> { return createDraft(request); }
