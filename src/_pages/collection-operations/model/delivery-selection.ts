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
