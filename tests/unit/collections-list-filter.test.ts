import { describe, it, expect } from "vitest";
import { matchesStatusFilter, collectionStatusLabel } from "../../src/_pages/collection-lifecycle/model/status-filters";

describe("collections list status filter", () => {
  it("includes every active workshop status under 'Em reparo'", () => {
    const repairStatuses = ["in_workshop", "in_budget", "awaiting_approval", "approved", "in_service", "ready"] as const;
    for (const status of repairStatuses) {
      expect(matchesStatusFilter(status, "in_repair")).toBe(true);
    }
  });

  it("excludes non-workshop statuses from 'Em reparo'", () => {
    const excluded = ["draft", "collected", "canceled", "invoiced", "partial_delivery", "delivered", "rejected", "reopened"] as const;
    for (const status of excluded) {
      expect(matchesStatusFilter(status, "in_repair")).toBe(false);
    }
  });

  it("'Coletadas' matches only collected and 'Prontas' only ready", () => {
    expect(matchesStatusFilter("collected", "collected")).toBe(true);
    expect(matchesStatusFilter("ready", "collected")).toBe(false);
    expect(matchesStatusFilter("ready", "ready")).toBe(true);
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
