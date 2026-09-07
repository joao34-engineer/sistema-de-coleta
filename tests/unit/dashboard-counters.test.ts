import { describe, it, expect } from "vitest";
import { matchesStatusFilter, inRepairStatuses, readyForDeliveryStatuses } from "../../src/_pages/collection-lifecycle/model/status-filters";
import { countInProgress, countReadyForDelivery, formatDashboardDateLabel, type DashboardActivityItem } from "../../src/_pages/dashboard/model/contracts";

function item(status: DashboardActivityItem["status"]): DashboardActivityItem {
  return {
    id: "id",
    officialCode: null,
    status,
    customerName: null,
    createdAt: "2026-09-06T00:00:00Z",
  };
}

describe("dashboard status buckets", () => {
  it("ready does not match the in_repair bucket", () => {
    expect(matchesStatusFilter("ready", "in_repair")).toBe(false);
  });

  it("rejected matches the in_repair bucket", () => {
    expect(matchesStatusFilter("rejected", "in_repair")).toBe(true);
  });

  it("counts ready, invoiced and partial_delivery as ready for delivery without using the list chip", () => {
    expect(readyForDeliveryStatuses).toEqual(["ready", "invoiced", "partial_delivery"]);
    expect(matchesStatusFilter("invoiced", "ready")).toBe(false);
    expect(matchesStatusFilter("partial_delivery", "ready")).toBe(false);
  });

  it("inRepairStatuses does not include ready", () => {
    expect(inRepairStatuses).not.toContain("ready");
  });
});

describe("dashboard counters", () => {
  it("countReadyForDelivery counts invoiced as ready", () => {
    expect(countReadyForDelivery([item("invoiced")])).toBe(1);
  });

  it("countReadyForDelivery counts only one ready item and ignores delivered", () => {
    expect(countReadyForDelivery([item("ready"), item("delivered")])).toBe(1);
  });

  it("countInProgress excludes draft, canceled and delivered but includes invoiced", () => {
    expect(countInProgress([item("draft"), item("canceled"), item("delivered")])).toBe(0);
    expect(countInProgress([item("invoiced"), item("in_service"), item("rejected")])).toBe(3);
  });
});

describe("formatDashboardDateLabel", () => {
  it("formats weekday and month without a year", () => {
    const label = formatDashboardDateLabel(new Date("2026-08-14T15:00:00.000Z"));
    expect(label).toMatch(/14 de agosto/);
    expect(label).not.toMatch(/2026/);
  });
});
