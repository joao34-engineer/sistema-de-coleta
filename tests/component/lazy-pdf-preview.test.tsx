import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LazyPdfPreview } from "@/_pages/collection-documents/ui/lazy-pdf-preview";

describe("LazyPdfPreview", () => {
  it("does not mount the iframe until the operator asks to preview", () => {
    render(
      <LazyPdfPreview src="/api/documents/doc-1/download?artifact=pdf" title="Visualizador de PDF da Coleta MJT" />,
    );

    expect(screen.queryByTitle("Visualizador de PDF da Coleta MJT")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Pré-visualizar" }));
    expect(screen.getByTitle("Visualizador de PDF da Coleta MJT")).toHaveAttribute(
      "src",
      "/api/documents/doc-1/download?artifact=pdf",
    );
  });
});
