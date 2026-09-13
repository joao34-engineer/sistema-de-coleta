import type { BudgetItem } from "./view-models";

export function budgetTotalOf(items: ReadonlyArray<Pick<BudgetItem, "laborCostBrl" | "partsCostBrl">>): number {
  return items.reduce((total, item) => total + item.laborCostBrl + item.partsCostBrl, 0);
}
