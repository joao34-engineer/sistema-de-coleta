import { describe, expect, it } from "vitest";
import { toCollectionEventSummaries, toCollectionHubView } from "@/_pages/collection-operations/model/hub-view";

const collectionId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const itemId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const documentId = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const eventId = "dddddddd-dddd-dddd-dddd-dddddddddddd";

describe("toCollectionHubView", () => {
  it("maps a collection with customer and current document", () => {
    expect(
      toCollectionHubView({
        id: collectionId,
        officialCode: "MJT-2026-000001",
        status: "in_service",
        customer: { name: "Oficina Sul", taxId: "12345678000195", phone: "11987654321" },
        collectedAt: "2026-09-12T12:00:00.000Z",
        items: [{ id: itemId, description: "Motor elétrico", quantity: 1 }],
        currentDocument: {
          id: documentId,
          version: 2,
          status: "rendered",
          issuedAt: "2026-09-12T13:00:00.000Z",
        },
      }),
    ).toEqual({
      id: collectionId,
      officialCode: "MJT-2026-000001",
      status: "in_service",
      customer: { name: "Oficina Sul", taxId: "12345678000195", phone: "11987654321" },
      collectedAt: "2026-09-12T12:00:00.000Z",
      items: [{ id: itemId, description: "Motor elétrico", quantity: 1 }],
      currentDocument: {
        id: documentId,
        version: 2,
        status: "rendered",
        issuedAt: "2026-09-12T13:00:00.000Z",
      },
    });
  });

  it("keeps customer and current document null", () => {
    expect(
      toCollectionHubView({
        id: collectionId,
        officialCode: null,
        status: "draft",
        customer: null,
        collectedAt: null,
        items: [],
        currentDocument: null,
      }),
    ).toEqual({
      id: collectionId,
      officialCode: null,
      status: "draft",
      customer: null,
      collectedAt: null,
      items: [],
      currentDocument: null,
    });
  });
});

describe("toCollectionEventSummaries", () => {
  it("maps timeline events", () => {
    expect(
      toCollectionEventSummaries([
        {
          id: eventId,
          type: "status_changed",
          previousStatus: "in_workshop",
          nextStatus: "in_service",
          reason: null,
          actorName: "Admin",
          createdAt: "2026-09-12T12:00:00.000Z",
        },
      ]),
    ).toEqual([
      {
        id: eventId,
        type: "status_changed",
        previousStatus: "in_workshop",
        nextStatus: "in_service",
        reason: null,
        actorName: "Admin",
        createdAt: "2026-09-12T12:00:00.000Z",
      },
    ]);
  });
});
