import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getCollectionDetail } from "@/_pages/collection-lifecycle/api/queries";
import {
  isWorkshopSegmentAllowed,
  type OperationalSegment,
} from "@/_pages/collection-operations/model/operational-actions";

export async function loadCollectionForOperation(id: string, segment: OperationalSegment) {
  if (!z.string().uuid().safeParse(id).success) notFound();
  const collection = await getCollectionDetail(id);
  if (!collection) notFound();
  if (!isWorkshopSegmentAllowed(collection.status, segment)) {
    redirect(`/coletas/${id}`);
  }
  return collection;
}
