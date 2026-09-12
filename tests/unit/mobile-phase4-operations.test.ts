import { describe, it, expect } from "vitest";
import {
  workshopCheckInSchema,
  technicalBudgetSchema,
  budgetApprovalSchema,
  serviceProgressSchema,
  invoiceReferenceSchema,
  customerDeliverySchema,
  cancelReopenSchema,
} from "../../src/_pages/collection-operations/model/contracts";

describe("Phase 4 Operations & Workshop Zod Contracts", () => {
  const sampleUuid = "d3b07384-d113-40a2-a9b3-6c845b410001";
  const sampleCnpj = "12.345.678/0001-95";

  it("validates workshop check-in schema (O02)", () => {
    const validCheckIn = {
      collectionId: sampleUuid,
      expectedVersion: 1,
      administratorName: "Carlos Silva",
      administratorTaxId: sampleCnpj,
      items: [
        {
          itemId: sampleUuid,
          itemDescription: "Motor WEG 15HP",
          arrivalStatus: "arrived",
          quantityObserved: 2,
          conditionObserved: "Sem avarias visíveis",
        },
      ],
      signatureIntentId: sampleUuid,
    };

    const result = workshopCheckInSchema.safeParse(validCheckIn);
    expect(result.success).toBe(true);

    const missingCheckIn = {
      ...validCheckIn,
      items: [
        {
          itemId: sampleUuid,
          itemDescription: "Ferro industrial",
          arrivalStatus: "missing",
          quantityObserved: 0,
          conditionObserved: "nao_recebido",
          divergenceNotes: "Não veio na carga",
        },
      ],
    };
    expect(workshopCheckInSchema.safeParse(missingCheckIn).success).toBe(true);
    expect(
      workshopCheckInSchema.safeParse({
        ...missingCheckIn,
        items: [{ ...missingCheckIn.items[0], divergenceNotes: "" }],
      }).success,
    ).toBe(false);

    const invalidCheckIn = { ...validCheckIn, administratorName: "" };
    expect(workshopCheckInSchema.safeParse(invalidCheckIn).success).toBe(false);
  });

  it("validates technical budget schema (O03)", () => {
    const validBudget = {
      collectionId: sampleUuid,
      expectedVersion: 1,
      items: [
        {
          itemId: sampleUuid,
          itemDescription: "Motor WEG 15HP",
          laborCostBrl: 450.5,
          partsCostBrl: 200,
          estimatedDays: 3,
        },
      ],
    };

    const result = technicalBudgetSchema.safeParse(validBudget);
    expect(result.success).toBe(true);
    if (result.success) {
      const total = result.data.items.reduce((s, i) => s + i.laborCostBrl + i.partsCostBrl, 0);
      expect(total).toBe(650.5);
    }
  });

  it("enforces mandatory reason on budget rejection (M13)", () => {
    const approvedData = {
      collectionId: sampleUuid,
      expectedVersion: 1,
      approved: true,
      signerName: "Roberto Salvat",
      signerTaxId: "12345678909",
    };
    expect(budgetApprovalSchema.safeParse(approvedData).success).toBe(true);

    const rejectedNoReason = {
      ...approvedData,
      approved: false,
      rejectionReason: "abc",
    };
    expect(budgetApprovalSchema.safeParse(rejectedNoReason).success).toBe(false);

    const rejectedValid = {
      ...approvedData,
      approved: false,
      rejectionReason: "Valor excede o orçamento autorizado para o setor.",
    };
    expect(budgetApprovalSchema.safeParse(rejectedValid).success).toBe(true);
  });

  it("validates manual invoice reference schema (M15)", () => {
    const validNfe = {
      collectionId: sampleUuid,
      expectedVersion: 1,
      number: "0001049",
      series: "1",
      issuedAt: "2026-08-21",
      totalBrl: 1250.75,
    };
    expect(invoiceReferenceSchema.safeParse(validNfe).success).toBe(true);

    const invalidNfeTotal = { ...validNfe, totalBrl: 0 };
    expect(invoiceReferenceSchema.safeParse(invalidNfeTotal).success).toBe(false);
  });

  it("supports partial and full delivery contracts (O04)", () => {
    const validDelivery = {
      collectionId: sampleUuid,
      expectedVersion: 1,
      deliveredItemIds: [sampleUuid],
      receiverName: "Marcio Souza",
      receiverTaxId: "12345678909",
      signatureIntentId: sampleUuid,
    };
    expect(customerDeliverySchema.safeParse(validDelivery).success).toBe(true);

    const emptyItemsDelivery = { ...validDelivery, deliveredItemIds: [] };
    expect(customerDeliverySchema.safeParse(emptyItemsDelivery).success).toBe(false);
  });

  it("rejects duplicate delivered item ids with a machine-readable refine", () => {
    const otherUuid = "d3b07384-d113-40a2-a9b3-6c845b410002";
    const duplicateDelivery = {
      collectionId: sampleUuid,
      expectedVersion: 1,
      deliveredItemIds: [sampleUuid, sampleUuid, otherUuid],
      receiverName: "Marcio Souza",
      receiverTaxId: "12345678909",
      signatureIntentId: sampleUuid,
    };
    const result = customerDeliverySchema.safeParse(duplicateDelivery);
    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    expect(result.error.issues.some((issue) => issue.message.includes("mais de uma vez"))).toBe(true);
  });

  it("validates service progress schema (M14)", () => {
    const validProgress = {
      collectionId: sampleUuid,
      expectedVersion: 1,
      items: [
        {
          itemId: sampleUuid,
          itemDescription: "Motor WEG 15HP",
          status: "pronto",
        },
      ],
    };
    expect(serviceProgressSchema.safeParse(validProgress).success).toBe(true);

    const invalidStatus = { ...validProgress, items: [{ ...validProgress.items[0], status: "invalid" }] };
    expect(serviceProgressSchema.safeParse(invalidStatus).success).toBe(false);
  });

  it("validates cancel and reopen reason schema (O05)", () => {
    const cancelData = {
      collectionId: sampleUuid,
      expectedVersion: 1,
      action: "cancel",
      reason: "Cancelamento solicitado pelo cliente via e-mail formal.",
    };
    expect(cancelReopenSchema.safeParse(cancelData).success).toBe(true);

    const shortReason = { ...cancelData, reason: "erro" };
    expect(cancelReopenSchema.safeParse(shortReason).success).toBe(false);
  });
});
