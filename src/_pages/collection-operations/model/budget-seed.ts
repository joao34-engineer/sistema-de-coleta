import type { BudgetItem, CollectionItemSummary } from "./view-models";

/** Linha do formulário de orçamento técnico (persistida ou seed a partir da coleta). */
export type BudgetFormLine = BudgetItem & {
  itemDescription: string;
};

type SeedBudgetItemsInput = Readonly<{
  collectionItems: ReadonlyArray<Pick<CollectionItemSummary, "id" | "description">>;
  budgetItems: ReadonlyArray<BudgetItem>;
}>;

/**
 * Resolve as linhas do formulário de orçamento.
 * Preferência: itens persistidos em `service_order_items`; se vazios, seed a partir dos itens da coleta.
 */
export function seedBudgetItemsFromCollection({
  collectionItems,
  budgetItems,
}: SeedBudgetItemsInput): ReadonlyArray<BudgetFormLine> {
  if (budgetItems.length > 0) {
    return budgetItems.map((item) => ({
      ...item,
      itemDescription:
        collectionItems.find((collectionItem) => collectionItem.id === item.collectionItemId)?.description ??
        "Item da coleta",
    }));
  }

  if (collectionItems.length > 0) {
    return collectionItems.map((collectionItem) => ({
      id: collectionItem.id,
      collectionItemId: collectionItem.id,
      itemDescription: collectionItem.description,
      laborCostBrl: 0,
      partsCostBrl: 0,
      estimatedDays: 1,
      status: null,
      notes: null,
    }));
  }

  return [];
}
