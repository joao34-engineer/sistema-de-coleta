import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getCollectionDetail } from "@/_pages/collection-lifecycle/api/queries";
import { getBudgetItems } from "@/_pages/collection-operations/api/queries";
import {
  isWorkshopSegmentAllowed,
  operationalItemFactsFrom,
  type OperationalSegment,
} from "@/_pages/collection-operations/model/operational-actions";

export async function loadCollectionForOperation(id: string, segment: OperationalSegment) {
  if (!z.string().uuid().safeParse(id).success) notFound();
  const collection = await getCollectionDetail(id);
  if (!collection) notFound();

  const needsItemFacts = collection.status === "in_service" || collection.status === "partial_delivery";
  const itemFacts = needsItemFacts
    ? operationalItemFactsFrom(
        collection.items.map((item) => item.id),
        await getBudgetItems(id),
      )
    : undefined;

  if (!isWorkshopSegmentAllowed(collection.status, segment, itemFacts)) {
    redirect(`/coletas/${id}`);
  }
  return collection;
}
