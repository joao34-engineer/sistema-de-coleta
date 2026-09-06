import "server-only";

import { requireAuthenticatedAdministrator } from "@/shared/auth/require-admin";
import { createServerSupabaseClient } from "@/shared/auth/supabase-server";
import { attachActorId } from "@/shared/lib/server-logger";
import { inProgressStatuses, readyForDeliveryStatuses } from "@/shared/model/collection-status";
import { dashboardSummarySchema, type DashboardSummaryDTO } from "../model/contracts";

const summaryKeyAliases: Readonly<Record<string, string>> = {
  inprogress: "inProgress",
  readyfordelivery: "readyForDelivery",
};

function normalizeSummaryPayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeSummaryPayload);
  if (typeof value !== "object" || value === null) return value;
  const record = value as Readonly<Record<string, unknown>>;
  return Object.fromEntries(
    Object.entries(record).map(([key, nested]) => [summaryKeyAliases[key] ?? key, normalizeSummaryPayload(nested)]),
  );
}

export async function getCollectionDashboardSummary(): Promise<DashboardSummaryDTO> {
  const administrator = await requireAuthenticatedAdministrator();
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc("collection_dashboard_summary", {
      p_in_progress: [...inProgressStatuses],
      p_ready_for_delivery: [...readyForDeliveryStatuses],
    });
    if (error) throw error;
    const parsed = dashboardSummarySchema.safeParse(normalizeSummaryPayload(data));
    if (!parsed.success) throw new Error("dashboard_summary_contract_invalid");
    return parsed.data;
  } catch (error: unknown) {
    throw attachActorId(error, administrator.userId);
  }
}
