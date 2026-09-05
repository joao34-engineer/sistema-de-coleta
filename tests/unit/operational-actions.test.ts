import { describe, expect, it } from "vitest";
import { collectionStatuses, type CollectionStatus } from "@/shared/model/collection-status";
import {
  nextOperationalAction,
  operationalActionsForStatus,
  secondaryOperationalAction,
} from "@/_pages/collection-operations/model/operational-actions";

const expectedPrimary: Readonly<Partial<Record<CollectionStatus, { segment: string; label: string }>>> = {
  collected: { segment: "checkin", label: "Entrada na oficina" },
  in_workshop: { segment: "orcamento", label: "Registrar orçamento" },
  in_budget: { segment: "aprovacao", label: "Aprovar orçamento" },
  awaiting_approval: { segment: "aprovacao", label: "Aprovar orçamento" },
  approved: { segment: "progresso", label: "Atualizar progresso" },
  in_service: { segment: "progresso", label: "Atualizar progresso" },
  ready: { segment: "nfe", label: "Registrar NF-e" },
  invoiced: { segment: "entrega", label: "Entregar ao cliente" },
  partial_delivery: { segment: "entrega", label: "Entregar ao cliente" },
  canceled: { segment: "reabrir", label: "Reabrir" },
  rejected: { segment: "orcamento", label: "Novo orçamento" },
};

const statusesWithCancel = new Set<CollectionStatus>([
  "rejected",
  "collected",
  "in_workshop",
  "in_budget",
  "awaiting_approval",
  "approved",
  "in_service",
  "ready",
  "invoiced",
  "partial_delivery",
]);

describe("operationalActionsForStatus (B14)", () => {
  it.each(collectionStatuses)("covers status %s", (status) => {
    const pair = operationalActionsForStatus(status);
    const expected = expectedPrimary[status] ?? null;

    if (expected === null) {
      expect(pair.primary).toBeNull();
    } else {
      expect(pair.primary).toEqual(expected);
    }

    if (statusesWithCancel.has(status)) {
      expect(pair.secondary).toEqual({ segment: "cancelar", label: "Cancelar" });
    } else {
      expect(pair.secondary).toBeNull();
    }

    expect(nextOperationalAction(status)).toEqual(pair.primary);
    expect(secondaryOperationalAction(status)).toEqual(pair.secondary);
  });

  it("shows Reabrir only on canceled", () => {
    for (const status of collectionStatuses) {
      const primary = nextOperationalAction(status);
      if (status === "canceled") {
        expect(primary).toEqual({ segment: "reabrir", label: "Reabrir" });
      } else {
        expect(primary?.segment).not.toBe("reabrir");
      }
    }
  });

  it("maps rejected to Novo orçamento and Cancelar", () => {
    expect(operationalActionsForStatus("rejected")).toEqual({
      primary: { segment: "orcamento", label: "Novo orçamento" },
      secondary: { segment: "cancelar", label: "Cancelar" },
    });
  });

  it("treats reopened as unreachable (no CTAs)", () => {
    expect(operationalActionsForStatus("reopened")).toEqual({
      primary: null,
      secondary: null,
    });
  });

  it("hides CTAs for delivered and draft", () => {
    expect(operationalActionsForStatus("delivered")).toEqual({ primary: null, secondary: null });
    expect(operationalActionsForStatus("draft")).toEqual({ primary: null, secondary: null });
  });
});
