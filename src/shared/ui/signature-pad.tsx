"use client";

import * as React from "react";
import { Button } from "./button";

export interface SignaturePadProps {
  onSave?: (dataUrl: string) => void;
  onClear?: () => void;
  disabled?: boolean;
}

export type SignaturePadPhase = "idle" | "drawn" | "confirmed";

export const SignaturePad: React.FC<SignaturePadProps> = ({ onSave, onClear, disabled = false }) => {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = React.useState(false);
  const [phase, setPhase] = React.useState<SignaturePadPhase>("idle");

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      const touch = e.touches[0];
      if (!touch) return { x: 0, y: 0 };
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    if (phase === "confirmed") {
      onClear?.();
    }
    setPhase("drawn");
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.strokeStyle = "#28312b";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setPhase("idle");
    onClear?.();
  };

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    if (!canvas || phase !== "drawn") return;
    const dataUrl = canvas.toDataURL("image/png");
    setPhase("confirmed");
    onSave?.(dataUrl);
  };

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvas.parentElement?.clientWidth ?? 340;
    canvas.height = 180;
  }, []);

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="relative w-full overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-inner">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="h-[180px] w-full touch-none cursor-crosshair bg-white"
        />
        {phase === "idle" ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-[var(--color-muted)]">
            Assine com o dedo ou mouse nesta área
          </div>
        ) : null}
      </div>
      {phase === "drawn" ? (
        <p className="text-[12px] font-medium text-[#a36b2c]">Confirme a assinatura para emitir a guia.</p>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <Button variant="secondary" size="sm" type="button" onClick={handleClear} disabled={disabled || phase === "idle"}>
          Limpar Assinatura
        </Button>
        <Button variant="primary" size="sm" type="button" onClick={handleConfirm} disabled={disabled || phase !== "drawn"}>
          Confirmar Assinatura
        </Button>
      </div>
    </div>
  );
};
