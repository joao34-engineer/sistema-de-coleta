import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { canFinalizeCollection } from "@/_pages/collection-drafts/model/can-finalize-collection";
import { SignaturePad } from "@/shared/ui/signature-pad";
import { useState } from "react";

function FinalizeHarness() {
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const enabled = canFinalizeCollection({
    collectionLocation: "Rua da Oficina",
    signatureDataUrl,
    signerName: "Ana Souza",
    signerTaxId: "52998224725",
  });
  return (
    <div>
      <SignaturePad onSave={setSignatureDataUrl} onClear={() => setSignatureDataUrl(null)} />
      <button type="button" disabled={!enabled}>
        Finalizar coleta
      </button>
    </div>
  );
}

describe("finalize gate after signature confirm", () => {
  afterEach(() => cleanup());

  it("keeps Finalizar disabled after drawing until Confirmar Assinatura", () => {
    HTMLCanvasElement.prototype.getContext = function getContext(contextId: string) {
      if (contextId !== "2d") {
        return null;
      }
      return {
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        clearRect: vi.fn(),
      };
    } as typeof HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.toDataURL = function toDataURL() {
      return "data:image/png;base64,abc";
    };

    render(<FinalizeHarness />);
    const canvas = document.querySelector("canvas");
    expect(canvas).not.toBeNull();
    if (canvas === null) {
      return;
    }
    fireEvent.mouseDown(canvas, { clientX: 10, clientY: 10 });
    fireEvent.mouseMove(canvas, { clientX: 20, clientY: 20 });
    fireEvent.mouseUp(canvas);
    expect(screen.getByText("Confirme a assinatura para emitir a guia.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Finalizar coleta" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar Assinatura" }));
    expect(screen.getByRole("button", { name: "Finalizar coleta" })).toBeEnabled();
  });
});
