import type {
  CollectionEventSummary,
  CollectionHubView,
  CollectionItemSummary,
  CollectionStatus,
  CurrentDocumentSummary,
  CustomerSummary,
} from "./view-models";

export type CollectionHubViewSource = Readonly<{
  id: string;
  officialCode: string | null;
  status: CollectionStatus;
  customer: CustomerSummary | null;
  collectedAt: string | null;
  items: ReadonlyArray<CollectionItemSummary>;
  currentDocument: CurrentDocumentSummary | null;
}>;

export type CollectionEventSummarySource = Readonly<{
  id: string;
  type: string;
  previousStatus: CollectionStatus | null;
  nextStatus: CollectionStatus | null;
  reason: string | null;
  actorName: string | null;
  createdAt: string;
}>;

export function toCollectionHubView(collection: CollectionHubViewSource): CollectionHubView {
  return {
    id: collection.id,
    officialCode: collection.officialCode,
    status: collection.status,
    customer: collection.customer
      ? { name: collection.customer.name, taxId: collection.customer.taxId, phone: collection.customer.phone }
      : null,
    collectedAt: collection.collectedAt,
    items: collection.items.map((item) => ({ id: item.id, description: item.description, quantity: item.quantity })),
    currentDocument: collection.currentDocument
      ? {
          id: collection.currentDocument.id,
          version: collection.currentDocument.version,
          status: collection.currentDocument.status,
          issuedAt: collection.currentDocument.issuedAt,
        }
      : null,
  };
}

export function toCollectionEventSummaries(
  events: ReadonlyArray<CollectionEventSummarySource>,
): ReadonlyArray<CollectionEventSummary> {
  return events.map((event) => ({
    id: event.id,
    type: event.type,
    previousStatus: event.previousStatus,
    nextStatus: event.nextStatus,
    reason: event.reason,
    actorName: event.actorName,
    createdAt: event.createdAt,
  }));
}
