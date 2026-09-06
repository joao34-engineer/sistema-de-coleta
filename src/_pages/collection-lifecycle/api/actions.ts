"use server";

import { toActionFailureCode } from "@/shared/lib/action-failure-code";
import { listCollections } from "./queries";
import { collectionQuerySchema, type CollectionListResultDTO } from "../model/contracts";

export type LoadMoreCollectionsResult =
  | { ok: true; data: CollectionListResultDTO }
  | { ok: false; error: string };

export async function loadMoreCollectionsAction(input: unknown): Promise<LoadMoreCollectionsResult> {
  const parsed = collectionQuerySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation_error" };
  try {
    return { ok: true, data: await listCollections(parsed.data) };
  } catch (error: unknown) {
    return { ok: false, error: toActionFailureCode(error) };
  }
}
