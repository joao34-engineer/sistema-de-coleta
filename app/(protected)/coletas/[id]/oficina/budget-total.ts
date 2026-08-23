import type { BudgetItem } from "@/_pages/collection-operations/model/view-models";

export function budgetTotalOf(items: ReadonlyArray<BudgetItem>): number {
  return items.reduce((total, item) => total + item.laborCostBrl + item.partsCostBrl, 0);
}
