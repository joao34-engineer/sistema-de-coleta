import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getCollectionDetail, getCollectionEvents } from "@/_pages/collection-lifecycle/api/queries";
import {
  getServiceOrder,
  getBudgetItems,
  loadAlreadyDeliveredItemIds,
} from "@/_pages/collection-operations/api/queries";
import { CollectionDetailHub } from "@/_pages/collection-operations/ui/collection-detail-hub";

export const dynamic = "force-dynamic";

const collectionIdSchema = z.string().uuid();

export default async function CollectionDetailRoute({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  if (!collectionIdSchema.safeParse(id).success) notFound();

  const [collection, eventsResult, serviceOrder, budgetItems, alreadyDeliveredItemIds] = await Promise.all([
    getCollectionDetail(id),
    getCollectionEvents(id, null, 50),
    getServiceOrder(id).catch(() => null),
    getBudgetItems(id),
    loadAlreadyDeliveredItemIds(id),
  ]);

  if (!collection) redirect(`/coletas/${id}/itens`);

  const hubView = {
    id: collection.id,
    officialCode: collection.officialCode,
    status: collection.status,
    customer: collection.customer ? { name: collection.customer.name, taxId: collection.customer.taxId, phone: collection.customer.phone } : null,
    collectedAt: collection.collectedAt,
    items: collection.items.map((item) => ({ id: item.id, description: item.description, quantity: item.quantity })),
    currentDocument: collection.currentDocument
      ? { id: collection.currentDocument.id, version: collection.currentDocument.version, status: collection.currentDocument.status, issuedAt: collection.currentDocument.issuedAt }
      : null,
  };
  const eventSummaries = eventsResult.items.map((event) => ({
    id: event.id,
    type: event.type,
    previousStatus: event.previousStatus,
    nextStatus: event.nextStatus,
    reason: event.reason,
    actorName: event.actorName,
    createdAt: event.createdAt,
  }));

  return (
    <CollectionDetailHub
      collection={hubView}
      events={eventSummaries}
      serviceOrder={serviceOrder}
      budgetItems={budgetItems}
      alreadyDeliveredItemIds={alreadyDeliveredItemIds}
    />
  );
}
