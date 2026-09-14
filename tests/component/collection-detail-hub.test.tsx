import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CollectionDetailHub } from "@/_pages/collection-operations/ui/collection-detail-hub";
import type { CollectionHubView } from "@/_pages/collection-operations/model/view-models";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/coletas/11111111-1111-4111-8111-111111111111",
}));

vi.mock("next/link", async () => {
  const React = await import("react");
  const MockLink = ({
    href,
    children,
    className,
  }: Readonly<{
    href: string;
    children: React.ReactNode;
    className?: string;
  }>) => React.createElement("a", { href, className }, children);

  return {
    __esModule: true,
    default: MockLink,
    useLinkStatus: vi.fn(() => ({ pending: false })),
  };
});

const collection: CollectionHubView = {
  id: "11111111-1111-4111-8111-111111111111",
  officialCode: "MJT-2026-000021",
  status: "collected",
  customer: { name: "Clínica Horizonte", taxId: "00000000000100", phone: "11988880000" },
  collectedAt: "2026-08-14T13:32:00.000Z",
  items: [
    { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", description: "Máquina de costura", quantity: 1 },
    { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", description: "Ferro industrial", quantity: 1 },
  ],
  currentDocument: {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    version: 1,
    status: "rendered",
    issuedAt: "2026-08-14T13:32:00.000Z",
  },
};

describe("CollectionDetailHub", () => {
  afterEach(() => cleanup());

  it("uses the Figma hub header, customer headline and timeline label", () => {
    render(
      <CollectionDetailHub
        collection={collection}
        events={[]}
        serviceOrder={null}
        budgetItems={[]}
        alreadyDeliveredItemIds={[]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Guia MJT-2026-000021" })).toBeInTheDocument();
    expect(screen.getByText("2 itens · Coletada")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Clínica Horizonte" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Linha do tempo" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver documentos emitidos" })).toHaveAttribute(
      "href",
      "/coletas/11111111-1111-4111-8111-111111111111/documentos",
    );
    expect(screen.getByRole("link", { name: "Entrada na oficina" })).toHaveAttribute(
      "href",
      "/coletas/11111111-1111-4111-8111-111111111111/oficina/checkin",
    );
  });
});
