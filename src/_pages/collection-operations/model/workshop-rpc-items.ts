import type { ServiceProgressDTO, TechnicalBudgetDTO, WorkshopCheckInDTO } from "./contracts";

export type WorkshopCheckInRpcItem = Readonly<{
  item_id: string;
  item_description: string;
  quantity_observed: number;
  condition_observed: string;
  divergence_notes: string | null;
}>;

export type TechnicalBudgetRpcItem = Readonly<{
  item_id: string;
  item_description: string;
  labor_cost_brl: number;
  parts_cost_brl: number;
  estimated_days: number;
  notes: string | null;
}>;

export type ServiceProgressRpcItem = Readonly<{
  item_id: string;
  status: "em_reparo" | "pronto";
  notes: string | null;
}>;

export function toWorkshopCheckInRpcItems(items: WorkshopCheckInDTO["items"]): readonly WorkshopCheckInRpcItem[] {
  return items.map((item) => ({
    item_id: item.itemId,
    item_description: item.itemDescription,
    quantity_observed: item.quantityObserved,
    condition_observed: item.conditionObserved,
    divergence_notes: item.divergenceNotes ?? null,
  }));
}

export function toTechnicalBudgetRpcItems(items: TechnicalBudgetDTO["items"]): readonly TechnicalBudgetRpcItem[] {
  return items.map((item) => ({
    item_id: item.itemId,
    item_description: item.itemDescription,
    labor_cost_brl: item.laborCostBrl,
    parts_cost_brl: item.partsCostBrl,
    estimated_days: item.estimatedDays,
    notes: item.notes ?? null,
  }));
}

export function toServiceProgressRpcItems(items: ServiceProgressDTO["items"]): readonly ServiceProgressRpcItem[] {
  return items.map((item) => ({
    item_id: item.itemId,
    status: item.status,
    notes: item.notes ?? null,
  }));
}

export function parseJsonFormField(value: unknown): unknown {
  if (typeof value !== "string" || value.trim() === "") return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}
