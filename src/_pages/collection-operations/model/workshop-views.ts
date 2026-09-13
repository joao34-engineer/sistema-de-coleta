import type { ServiceOrderItemProgress } from "./delivery-selection";
import type { BudgetItem, CollectionItemSummary } from "./view-models";

export type WorkshopProgressItemView = Readonly<{
  itemId: string;
  itemDescription: string;
  status: ServiceOrderItemProgress;
  notes: string | null;
}>;

export type WorkshopDeliveryItemView = Readonly<{
  id: string;
  description: string;
  quantity: number;
  serviceOrderStatus: ServiceOrderItemProgress;
}>;

export type WorkshopCheckInItemView = Readonly<{
  id: string;
  description: string;
  quantity: number;
}>;

export function progressItemsFrom(
  collectionItems: ReadonlyArray<Pick<CollectionItemSummary, "id" | "description">>,
  budgetItems: ReadonlyArray<BudgetItem>,
  alreadyDeliveredItemIds: ReadonlyArray<string>,
): ReadonlyArray<WorkshopProgressItemView> {
  const deliveredItemIds = new Set(alreadyDeliveredItemIds);
  return collectionItems.flatMap((collectionItem) => {
    if (deliveredItemIds.has(collectionItem.id)) {
      return [];
    }
    const budgetItem = budgetItems.find((item) => item.collectionItemId === collectionItem.id);
    if (budgetItem === undefined || budgetItem.status === null) {
      return [];
    }
    return [{
      itemId: collectionItem.id,
      itemDescription: collectionItem.description,
      status: budgetItem.status,
      notes: budgetItem.notes ?? null,
    }];
  });
}

export function deliveryItemsFrom(
  collectionItems: ReadonlyArray<CollectionItemSummary>,
  budgetItems: ReadonlyArray<BudgetItem>,
): ReadonlyArray<WorkshopDeliveryItemView> {
  return collectionItems.flatMap((collectionItem) => {
    const budgetItem = budgetItems.find((item) => item.collectionItemId === collectionItem.id);
    if (budgetItem === undefined || budgetItem.status === null) {
      return [];
    }
    return [{
      id: collectionItem.id,
      description: collectionItem.description,
      quantity: collectionItem.quantity,
      serviceOrderStatus: budgetItem.status,
    }];
  });
}

export function checkInItemsFrom(
  collectionItems: ReadonlyArray<CollectionItemSummary>,
): ReadonlyArray<WorkshopCheckInItemView> {
  return collectionItems.map(({ id, description, quantity }) => ({ id, description, quantity }));
}
