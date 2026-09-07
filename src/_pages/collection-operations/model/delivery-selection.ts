export type ServiceOrderItemProgress = "em_reparo" | "pronto";

export function alreadyDeliveredCollectionItemIds(
  termItems: ReadonlyArray<{ collectionItemId: string }>,
): readonly string[] {
  return [...new Set(termItems.map((item) => item.collectionItemId))];
}

/** Product interim: never pre-select all ids or Pronto-only. */
export function defaultDeliveredItemIds(): readonly string[] {
  return [];
}

export function isAlreadyDeliveredItem(
  itemId: string,
  alreadyDeliveredItemIds: ReadonlyArray<string>,
): boolean {
  return alreadyDeliveredItemIds.includes(itemId);
}

/** Selectable only when the service-order line is Pronto and the item has no prior term. */
export function isDeliverableItem(
  serviceOrderStatus: ServiceOrderItemProgress,
  itemId: string,
  alreadyDeliveredItemIds: ReadonlyArray<string>,
): boolean {
  return serviceOrderStatus === "pronto" && !isAlreadyDeliveredItem(itemId, alreadyDeliveredItemIds);
}
