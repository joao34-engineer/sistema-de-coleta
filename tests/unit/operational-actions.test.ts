import { describe, expect, it } from "vitest";
import { collectionStatuses, type CollectionStatus } from "@/shared/model/collection-status";
import { serviceProgressResultSchema, customerDeliveryResultSchema } from "@/_pages/collection-operations/model/contracts";
import {
  alreadyDeliveredCollectionItemIds,
  defaultDeliveredItemIds,
  isAlreadyDeliveredItem,
  isDeliverableItem,
} from "@/_pages/collection-operations/model/delivery-selection";
import {
  isWorkshopSegmentAllowed,
  nextOperationalAction,
  operationalActionsForStatus,
  operationalItemFactsFrom,
  secondaryOperationalAction,
  optionalInvoiceAction,
  type OperationalItemFacts,
  type OperationalSegment,
} from "@/_pages/collection-operations/model/operational-actions";

const expectedPrimary: Readonly<Partial<Record<CollectionStatus, { segment: string; label: string }>>> = {
  collected: { segment: "checkin", label: "Entrada na oficina" },
  in_workshop: { segment: "orcamento", label: "Registrar orçamento" },
  in_budget: { segment: "aprovacao", label: "Aprovar orçamento" },
  awaiting_approval: { segment: "aprovacao", label: "Aprovar orçamento" },
  approved: { segment: "progresso", label: "Atualizar progresso" },
  in_service: { segment: "progresso", label: "Atualizar progresso" },
  ready: { segment: "entrega", label: "Entregar ao cliente" },
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

const bothFacts: OperationalItemFacts = {
  hasUndeliveredReadyItem: true,
  hasInRepairItem: true,
};

describe("operationalActionsForStatus (B14)", () => {
  it.each(collectionStatuses)("covers status %s without item facts", (status) => {
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

    expect(pair.extra).toBeNull();
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
      extra: null,
    });
  });

  it("treats reopened as unreachable (no CTAs)", () => {
    expect(operationalActionsForStatus("reopened")).toEqual({
      primary: null,
      secondary: null,
      extra: null,
    });
  });

  it("hides CTAs for delivered and draft", () => {
    expect(operationalActionsForStatus("delivered")).toEqual({
      primary: null,
      secondary: null,
      extra: null,
    });
    expect(operationalActionsForStatus("draft")).toEqual({
      primary: null,
      secondary: null,
      extra: null,
    });
  });

  it("keeps Entregar ao cliente after a first partial term", () => {
    expect(nextOperationalAction("invoiced")).toEqual({ segment: "entrega", label: "Entregar ao cliente" });
    expect(nextOperationalAction("partial_delivery")).toEqual({ segment: "entrega", label: "Entregar ao cliente" });
    expect(nextOperationalAction("delivered")).toBeNull();
  });

  it("uses Entregar as the primary CTA when the collection is ready (5.6)", () => {
    expect(nextOperationalAction("ready")).toEqual({ segment: "entrega", label: "Entregar ao cliente" });
    expect(secondaryOperationalAction("ready")).toEqual({ segment: "cancelar", label: "Cancelar" });
  });

  it("keeps the omitted-facts matrix byte-identical for in_service and partial_delivery", () => {
    expect(operationalActionsForStatus("in_service")).toEqual({
      primary: { segment: "progresso", label: "Atualizar progresso" },
      secondary: { segment: "cancelar", label: "Cancelar" },
      extra: null,
    });
    expect(operationalActionsForStatus("partial_delivery")).toEqual({
      primary: { segment: "entrega", label: "Entregar ao cliente" },
      secondary: { segment: "cancelar", label: "Cancelar" },
      extra: null,
    });
  });

  it("adds Entregar itens prontos only on in_service with an undelivered Pronto item", () => {
    expect(
      operationalActionsForStatus("in_service", {
        hasUndeliveredReadyItem: true,
        hasInRepairItem: true,
      }),
    ).toEqual({
      primary: { segment: "progresso", label: "Atualizar progresso" },
      secondary: { segment: "cancelar", label: "Cancelar" },
      extra: { segment: "entrega", label: "Entregar itens prontos" },
    });
    expect(
      operationalActionsForStatus("in_service", {
        hasUndeliveredReadyItem: false,
        hasInRepairItem: true,
      }).extra,
    ).toBeNull();
  });

  it("adds Atualizar progresso as primary on partial_delivery when only remaining items are in repair", () => {
    expect(
      operationalActionsForStatus("partial_delivery", {
        hasUndeliveredReadyItem: false,
        hasInRepairItem: true,
      }),
    ).toEqual({
      primary: { segment: "progresso", label: "Atualizar progresso" },
      secondary: { segment: "cancelar", label: "Cancelar" },
      extra: null,
    });
    expect(
      operationalActionsForStatus("partial_delivery", {
        hasUndeliveredReadyItem: true,
        hasInRepairItem: false,
      }),
    ).toEqual({
      primary: { segment: "entrega", label: "Entregar ao cliente" },
      secondary: { segment: "cancelar", label: "Cancelar" },
      extra: null,
    });
  });

  it("keeps Entregar as primary on partial_delivery when an undelivered Pronto remains", () => {
    expect(
      operationalActionsForStatus("partial_delivery", {
        hasUndeliveredReadyItem: true,
        hasInRepairItem: true,
      }),
    ).toEqual({
      primary: { segment: "entrega", label: "Entregar ao cliente" },
      secondary: { segment: "cancelar", label: "Cancelar" },
      extra: { segment: "progresso", label: "Atualizar progresso" },
    });
  });

  it("hides both workshop CTAs on partial_delivery when nothing remains deliverable or in repair", () => {
    expect(
      operationalActionsForStatus("partial_delivery", {
        hasUndeliveredReadyItem: false,
        hasInRepairItem: false,
      }),
    ).toEqual({
      primary: null,
      secondary: { segment: "cancelar", label: "Cancelar" },
      extra: null,
    });
  });

  it("mirrors the partial_delivery CTA matrix on invoiced", () => {
    expect(
      operationalActionsForStatus("invoiced", {
        hasUndeliveredReadyItem: false,
        hasInRepairItem: true,
      }),
    ).toEqual({
      primary: { segment: "progresso", label: "Atualizar progresso" },
      secondary: { segment: "cancelar", label: "Cancelar" },
      extra: null,
    });
    expect(
      operationalActionsForStatus("invoiced", {
        hasUndeliveredReadyItem: true,
        hasInRepairItem: false,
      }),
    ).toEqual({
      primary: { segment: "entrega", label: "Entregar ao cliente" },
      secondary: { segment: "cancelar", label: "Cancelar" },
      extra: null,
    });
    expect(
      operationalActionsForStatus("invoiced", {
        hasUndeliveredReadyItem: true,
        hasInRepairItem: true,
      }),
    ).toEqual({
      primary: { segment: "entrega", label: "Entregar ao cliente" },
      secondary: { segment: "cancelar", label: "Cancelar" },
      extra: { segment: "progresso", label: "Atualizar progresso" },
    });
    expect(
      operationalActionsForStatus("invoiced", {
        hasUndeliveredReadyItem: false,
        hasInRepairItem: false,
      }),
    ).toEqual({
      primary: null,
      secondary: { segment: "cancelar", label: "Cancelar" },
      extra: null,
    });
  });

  it.each(["ready", "collected", "approved", "delivered"] as const)(
    "keeps extra null on %s even when both item facts are true",
    (status) => {
      expect(operationalActionsForStatus(status, bothFacts).extra).toBeNull();
    },
  );
});

const workshopSegments: ReadonlyArray<OperationalSegment> = [
  "checkin",
  "orcamento",
  "aprovacao",
  "progresso",
  "nfe",
  "entrega",
  "reabrir",
  "cancelar",
];

describe("isWorkshopSegmentAllowed (5.17)", () => {
  it("matches the hub CTA matrix for every status and segment when facts are omitted", () => {
    for (const status of collectionStatuses) {
      const pair = operationalActionsForStatus(status);
      const optional = optionalInvoiceAction(status);
      for (const segment of workshopSegments) {
        const allowedByCta =
          pair.primary?.segment === segment ||
          pair.secondary?.segment === segment ||
          pair.extra?.segment === segment ||
          optional?.segment === segment;
        expect(isWorkshopSegmentAllowed(status, segment)).toBe(allowedByCta);
      }
    }
  });

  it("refuses check-in on draft and delivered", () => {
    expect(isWorkshopSegmentAllowed("draft", "checkin")).toBe(false);
    expect(isWorkshopSegmentAllowed("delivered", "checkin")).toBe(false);
    expect(isWorkshopSegmentAllowed("collected", "checkin")).toBe(true);
  });

  it("lets Pronto deliver without NF-e and keeps NF-e as an optional route (5.6 / L2)", () => {
    expect(nextOperationalAction("ready")).toEqual({ segment: "entrega", label: "Entregar ao cliente" });
    expect(optionalInvoiceAction("ready")).toEqual({ segment: "nfe", label: "Registrar NF-e (opcional)" });
    expect(optionalInvoiceAction("partial_delivery")).toEqual({
      segment: "nfe",
      label: "Registrar NF-e (opcional)",
    });
    expect(isWorkshopSegmentAllowed("ready", "entrega")).toBe(true);
    expect(isWorkshopSegmentAllowed("ready", "nfe")).toBe(true);
    expect(isWorkshopSegmentAllowed("partial_delivery", "nfe")).toBe(true);
    expect(isWorkshopSegmentAllowed("in_workshop", "nfe")).toBe(false);
    expect(isWorkshopSegmentAllowed("in_service", "nfe")).toBe(false);
    expect(optionalInvoiceAction("invoiced")).toBeNull();
    expect(nextOperationalAction("invoiced")).toEqual({ segment: "entrega", label: "Entregar ao cliente" });
  });

  it("does not open extra routes when item facts are omitted", () => {
    expect(isWorkshopSegmentAllowed("in_service", "entrega")).toBe(false);
    expect(isWorkshopSegmentAllowed("partial_delivery", "progresso")).toBe(false);
  });

  it("opens extra routes only when the matching item facts are present", () => {
    expect(
      isWorkshopSegmentAllowed("in_service", "entrega", {
        hasUndeliveredReadyItem: true,
        hasInRepairItem: false,
      }),
    ).toBe(true);
    expect(
      isWorkshopSegmentAllowed("in_service", "entrega", {
        hasUndeliveredReadyItem: false,
        hasInRepairItem: true,
      }),
    ).toBe(false);
    expect(
      isWorkshopSegmentAllowed("partial_delivery", "progresso", {
        hasUndeliveredReadyItem: false,
        hasInRepairItem: true,
      }),
    ).toBe(true);
    expect(
      isWorkshopSegmentAllowed("partial_delivery", "progresso", {
        hasUndeliveredReadyItem: true,
        hasInRepairItem: false,
      }),
    ).toBe(false);
    expect(
      isWorkshopSegmentAllowed("partial_delivery", "entrega", {
        hasUndeliveredReadyItem: false,
        hasInRepairItem: true,
      }),
    ).toBe(false);
    expect(
      isWorkshopSegmentAllowed("invoiced", "progresso", {
        hasUndeliveredReadyItem: false,
        hasInRepairItem: true,
      }),
    ).toBe(true);
    expect(
      isWorkshopSegmentAllowed("invoiced", "nfe", {
        hasUndeliveredReadyItem: true,
        hasInRepairItem: true,
      }),
    ).toBe(false);
  });
});

describe("operationalItemFactsFrom", () => {
  const readyId = "11111111-1111-4111-8111-111111111111";
  const missingId = "22222222-2222-4222-8222-222222222222";
  const deliveredReadyId = "33333333-3333-4333-8333-333333333333";

  it("treats a missing budget line as neither ready nor in repair", () => {
    expect(operationalItemFactsFrom([missingId], [])).toEqual({
      hasUndeliveredReadyItem: false,
      hasInRepairItem: false,
    });
  });

  it("does not count an already-delivered Pronto item as undelivered ready", () => {
    expect(
      operationalItemFactsFrom(
        [deliveredReadyId],
        [{ collectionItemId: deliveredReadyId, status: "pronto" }],
        [deliveredReadyId],
      ),
    ).toEqual({
      hasUndeliveredReadyItem: false,
      hasInRepairItem: false,
    });
  });

  it("does not count an already-delivered item still marked em_reparo as in repair", () => {
    const deliveredInRepairId = "44444444-4444-4444-8444-444444444444";
    expect(
      operationalItemFactsFrom(
        [deliveredInRepairId],
        [{ collectionItemId: deliveredInRepairId, status: "em_reparo" }],
        [deliveredInRepairId],
      ),
    ).toEqual({
      hasUndeliveredReadyItem: false,
      hasInRepairItem: false,
    });
  });

  it("does not treat a missing budget line as in repair next to an undelivered Pronto", () => {
    expect(
      operationalItemFactsFrom([readyId, missingId], [{ collectionItemId: readyId, status: "pronto" }]),
    ).toEqual({
      hasUndeliveredReadyItem: true,
      hasInRepairItem: false,
    });
  });
});

describe("delivery item selection (5.5)", () => {
  const first = "11111111-1111-4111-8111-111111111111";
  const second = "22222222-2222-4222-8222-222222222222";

  it("defaults the next delivery selection to empty, not all ids", () => {
    expect(defaultDeliveredItemIds()).toEqual([]);
  });

  it("collects unique already-delivered ids from prior term items", () => {
    expect(
      alreadyDeliveredCollectionItemIds([
        { collectionItemId: first },
        { collectionItemId: first },
        { collectionItemId: second },
      ]),
    ).toEqual([first, second]);
  });

  it("marks only prior-term items as already delivered", () => {
    expect(isAlreadyDeliveredItem(first, [first])).toBe(true);
    expect(isAlreadyDeliveredItem(second, [first])).toBe(false);
  });

  it("treats only undelivered Pronto items as deliverable", () => {
    expect(isDeliverableItem("pronto", first, [])).toBe(true);
    expect(isDeliverableItem("em_reparo", first, [])).toBe(false);
    expect(isDeliverableItem("pronto", first, [first])).toBe(false);
  });
});

describe("serviceProgressResultSchema", () => {
  const sample = {
    collectionId: "11111111-1111-4111-8111-111111111111",
    rowVersion: 3,
    serviceOrderId: "22222222-2222-4222-8222-222222222222",
  };

  it("accepts partial_delivery after a mid-repair leftover", () => {
    const result = serviceProgressResultSchema.safeParse({ ...sample, status: "partial_delivery" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("partial_delivery");
    }
  });

  it("accepts invoiced after NF-e on a leftover remaining in repair", () => {
    const result = serviceProgressResultSchema.safeParse({ ...sample, status: "invoiced" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("invoiced");
    }
  });

  it("rejects a bogus status", () => {
    expect(serviceProgressResultSchema.safeParse({ ...sample, status: "collected" }).success).toBe(false);
  });
});

describe("customerDeliveryResultSchema", () => {
  const sample = {
    collectionId: "11111111-1111-4111-8111-111111111111",
    rowVersion: 4,
    delivered: true,
    partial: true,
    deliveryTermId: "33333333-3333-4333-8333-333333333333",
  };

  it("accepts invoiced when a later delivery leaves remaining items", () => {
    const result = customerDeliveryResultSchema.safeParse({ ...sample, status: "invoiced" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("invoiced");
    }
  });
});
