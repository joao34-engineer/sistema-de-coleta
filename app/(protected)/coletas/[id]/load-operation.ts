import { notFound } from "next/navigation";
import { z } from "zod";
import { getCollectionDetail } from "@/_pages/collection-lifecycle/api/queries";

export async function loadCollectionForOperation(id: string) {
  if (!z.string().uuid().safeParse(id).success) notFound();
  const collection = await getCollectionDetail(id);
  if (!collection) notFound();
  return collection;
}
