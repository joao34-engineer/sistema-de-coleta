import "server-only";

import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getCollectionDetail, getCollectionEvents } from "@/_pages/collection-lifecycle/index.server";
import { getBudgetItems, getServiceOrder, loadAlreadyDeliveredItemIds } from "../api/queries";
import { toCollectionEventSummaries, toCollectionHubView } from "../model/hub-view";
import { CollectionDetailHub } from "./collection-detail-hub";

const collectionIdSchema = z.string().uuid();

export async function CollectionDetailHubRoute({ collectionId }: Readonly<{ collectionId: string }>) {
  if (!collectionIdSchema.safeParse(collectionId).success) notFound();

  const [collection, eventsResult, serviceOrder, budgetItems, alreadyDeliveredItemIds] = await Promise.all([
    getCollectionDetail(collectionId),
    getCollectionEvents(collectionId, null, 50),
    getServiceOrder(collectionId).catch(() => null),
    getBudgetItems(collectionId),
    loadAlreadyDeliveredItemIds(collectionId),
  ]);

  if (!collection) redirect(`/coletas/${collectionId}/itens`);

  return (
    <CollectionDetailHub
      collection={toCollectionHubView(collection)}
      events={toCollectionEventSummaries(eventsResult.items)}
      serviceOrder={serviceOrder}
      budgetItems={budgetItems}
      alreadyDeliveredItemIds={alreadyDeliveredItemIds}
    />
  );
}
