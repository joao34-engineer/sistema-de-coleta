import "server-only";

import { requireAuthenticatedAdministrator } from "@/shared/auth/require-admin";
import { attachActorId } from "@/shared/lib/server-logger";
import { collectionIdSchema, type DraftDTO, type DraftItemDTO } from "../model/draft";
import { createPhaseOneClient, draftColumns, itemColumns, mapDraft, mapItem } from "./draft-db";

export type DraftWithItems = Readonly<{
  draft: DraftDTO;
  items: readonly DraftItemDTO[];
  hasSignature: boolean;
}>;

export async function collectionExists(collectionId: string): Promise<boolean> {
  const parsedId = collectionIdSchema.safeParse(collectionId);
  if (!parsedId.success) return false;
  const administrator = await requireAuthenticatedAdministrator();
  const supabase = await createPhaseOneClient();
  const query = await supabase
    .from("collections")
    .select("id")
    .eq("organization_id", administrator.organizationId)
    .eq("id", parsedId.data)
    .maybeSingle();
  return !query.error && query.data != null;
}

export async function getDraft(id: string): Promise<DraftWithItems> {
  const parsedId = collectionIdSchema.safeParse(id);
  if (!parsedId.success) {
    throw new Error("validation_error");
  }
  const administrator = await requireAuthenticatedAdministrator();
  const supabase = await createPhaseOneClient();
  const [draftResult, itemResult, signatureResult] = await Promise.all([
    supabase.from("collections").select(draftColumns).eq("organization_id", administrator.organizationId).eq("id", parsedId.data).eq("status", "draft").maybeSingle(),
    supabase.from("collection_items").select(itemColumns).eq("organization_id", administrator.organizationId).eq("collection_id", parsedId.data).is("removed_at", null).order("created_at", { ascending: true }),
    supabase.from("signatures").select("id").eq("collection_id", parsedId.data).maybeSingle(),
  ]);
  const draft = mapDraft(draftResult.data);
  if (draftResult.error) {
    throw attachActorId(new Error("draft_query_failed"), administrator.userId);
  }
  if (!draft) {
    throw attachActorId(new Error("not_found"), administrator.userId);
  }
  const items = Array.isArray(itemResult.data) ? itemResult.data.map(mapItem).filter((value): value is DraftItemDTO => value !== null) : [];
  const hasSignature = signatureResult.data !== null && signatureResult.data !== undefined && !signatureResult.error;
  return { draft, items, hasSignature };
}
