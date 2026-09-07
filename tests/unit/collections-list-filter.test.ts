import { describe, it, expect } from "vitest";
import { matchesStatusFilter, collectionStatusLabel, inRepairStatuses } from "../../src/_pages/collection-lifecycle/model/status-filters";

describe("collections list status filter", () => {
  it("includes every active workshop status under 'Em reparo' except ready", () => {
    for (const status of inRepairStatuses) {
      expect(matchesStatusFilter(status, "in_repair")).toBe(true);
    }
    expect(matchesStatusFilter("ready", "in_repair")).toBe(false);
  });

  it("excludes non-workshop statuses from 'Em reparo'", () => {
    const excluded = ["draft", "collected", "canceled", "invoiced", "partial_delivery", "delivered", "reopened"] as const;
    for (const status of excluded) {
      expect(matchesStatusFilter(status, "in_repair")).toBe(false);
    }
  });

  it("'Coletada' matches only collected and 'Pronta' matches only ready", () => {
    expect(matchesStatusFilter("collected", "collected")).toBe(true);
    expect(matchesStatusFilter("ready", "collected")).toBe(false);
    expect(matchesStatusFilter("ready", "ready")).toBe(true);
    expect(matchesStatusFilter("invoiced", "ready")).toBe(false);
    expect(matchesStatusFilter("partial_delivery", "ready")).toBe(false);
    expect(matchesStatusFilter("invoiced", "invoiced")).toBe(true);
    expect(matchesStatusFilter("partial_delivery", "partial_delivery")).toBe(true);
    expect(matchesStatusFilter("in_service", "ready")).toBe(false);
  });

  it("'all' matches any known status", () => {
    const all = ["draft", "collected", "canceled", "in_workshop", "in_budget", "awaiting_approval", "approved", "in_service", "ready", "invoiced", "partial_delivery", "delivered", "rejected", "reopened"] as const;
    for (const status of all) {
      expect(matchesStatusFilter(status, "all")).toBe(true);
    }
  });

  it("provides a PT-BR label for every status", () => {
    expect(Object.keys(collectionStatusLabel).length).toBe(14);
    expect(collectionStatusLabel.in_service).toBe("Em reparo");
    expect(collectionStatusLabel.draft).toBe("Rascunho");
  });
});
