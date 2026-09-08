import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getCollectionDetail } from "@/_pages/collection-lifecycle/api/queries";
import type { CollectionDetailDTO } from "@/_pages/collection-lifecycle/model/contracts";
import { getBudgetItems, loadAlreadyDeliveredItemIds } from "@/_pages/collection-operations/api/queries";
import {
  isWorkshopSegmentAllowed,
  operationalItemFactsFrom,
  type OperationalItemFacts,
  type OperationalSegment,
} from "@/_pages/collection-operations/model/operational-actions";

export type CollectionOperationLoad = Readonly<{
  collection: CollectionDetailDTO;
  budgetItems: Awaited<ReturnType<typeof getBudgetItems>>;
  alreadyDeliveredItemIds: readonly string[];
}>;

const workshopItemSegments: ReadonlySet<OperationalSegment> = new Set([
  "entrega",
  "progresso",
  "orcamento",
  "aprovacao",
]);

export async function loadCollectionForOperation(
  id: string,
  segment: OperationalSegment,
): Promise<CollectionOperationLoad> {
  if (!z.string().uuid().safeParse(id).success) notFound();
  const collection = await getCollectionDetail(id);
  if (!collection) notFound();

  const needsWorkshopItems =
    workshopItemSegments.has(segment) ||
    collection.status === "in_service" ||
    collection.status === "partial_delivery";

  const [budgetItems, alreadyDeliveredItemIds] = needsWorkshopItems
    ? await Promise.all([getBudgetItems(id), loadAlreadyDeliveredItemIds(id)])
    : [[], [] as const];

  let itemFacts: OperationalItemFacts | undefined;
  if (
    collection.status === "in_service" ||
    collection.status === "partial_delivery" ||
    collection.status === "invoiced"
  ) {
    itemFacts = operationalItemFactsFrom(
      collection.items.map((item) => item.id),
      budgetItems,
      alreadyDeliveredItemIds,
    );
  }

  if (!isWorkshopSegmentAllowed(collection.status, segment, itemFacts)) {
    redirect(`/coletas/${id}`);
  }

  return { collection, budgetItems, alreadyDeliveredItemIds };
}
