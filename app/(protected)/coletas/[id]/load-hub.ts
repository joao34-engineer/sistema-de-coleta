import { notFound } from "next/navigation";
import { z } from "zod";
import { getCollectionDetail, getCollectionEvents } from "@/_pages/collection-lifecycle/api/queries";

export async function loadCollectionForOperation(id: string) {
  if (!z.string().uuid().safeParse(id).success) notFound();
  const collection = await getCollectionDetail(id);
  if (!collection) notFound();
  return collection;
}

export async function loadEventsForOperation(id: string) {
  const result = await getCollectionEvents(id, null, 50);
  return result.items;
}
