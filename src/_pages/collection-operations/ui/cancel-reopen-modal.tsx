"use client";

import { useState } from "react";
import { Button } from "@/shared/ui/button";
import { Card, CardHeader, CardContent } from "@/shared/ui/card";

export interface CancelReopenModalProps {
  collectionId: string;
  currentStatus: string;
  expectedVersion: number;
  onClose: () => void;
}

export function CancelReopenModal({ collectionId, currentStatus, expectedVersion, onClose }: CancelReopenModalProps) {
  const isCanceled = currentStatus === "canceled";
  const [action, setAction] = useState<"cancel" | "reopen">(isCanceled ? "reopen" : "cancel");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (reason.trim().length < 5) {
      setErrorMsg("Informe um motivo detalhado de no mínimo 5 caracteres.");
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      onClose();
      window.location.reload();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <Card className="w-full max-w-md bg-[var(--color-surface)] shadow-2xl rounded-[20px] border border-[var(--color-border)] p-2">
        <CardHeader className="flex flex-row items-center justify-between border-b border-[var(--color-border)] p-4">
          <h2 className="text-[18px] font-semibold text-[var(--color-text)]">
            Cancelar ou alterar status
          </h2>
          <button onClick={onClose} className="text-[var(--color-muted)] hover:text-[var(--color-text)] font-semibold text-[18px]">
            ✕
          </button>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <p className="text-[12px] text-[var(--color-muted)]">
            {action === "cancel"
              ? "O cancelamento registrará um evento imutável na timeline de auditoria da coleta."
              : "A reabertura restaurará a coleta para seu estado operacional anterior com evento auditado."}
          </p>

          <div className="flex rounded-[12px] bg-[var(--color-surface-neutral)] p-1 text-[12px] font-semibold">
            <button
              type="button"
              onClick={() => setAction("cancel")}
              className={`w-1/2 py-2 rounded-[10px] transition-all ${action === "cancel" ? "bg-[var(--color-surface)] text-[#ba5b52] shadow-xs" : "text-[var(--color-muted)]"}`}
            >
              Cancelar Coleta
            </button>
            <button
              type="button"
              onClick={() => setAction("reopen")}
              className={`w-1/2 py-2 rounded-[10px] transition-all ${action === "reopen" ? "bg-[var(--color-surface)] text-[var(--color-primary-strong)] shadow-xs" : "text-[var(--color-muted)]"}`}
            >
              Reabrir Coleta
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input type="hidden" name="collectionId" value={collectionId} />
            <input type="hidden" name="expectedVersion" value={expectedVersion} />

            <div>
              <label htmlFor="reason" className="mb-1.5 block text-[12px] font-semibold text-[var(--color-muted)]">
                Motivo / Justificativa Mandatória *
              </label>
              <textarea
                id="reason"
                rows={3}
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={
                  action === "cancel"
                    ? "Ex: Cliente desistiu da manutenção devido a custos..."
                    : "Ex: Cancelamento efetuado por engano..."
                }
                className="w-full rounded-[12px] border border-[var(--color-border)] p-3 text-[14px] text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none"
              />
            </div>

            {errorMsg && (
              <div className="rounded-[12px] bg-[#fdf2f1] border border-[#fca5a5] p-3 text-[12px] text-[#ba5b52] font-semibold">
                {errorMsg}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={onClose} size="md" className="w-1/2">
                Voltar
              </Button>
              <Button
                type="submit"
                variant={action === "cancel" ? "danger" : "primary"}
                isLoading={isSubmitting}
                size="md"
                className="w-1/2"
              >
                {action === "cancel" ? "Confirmar" : "Reabrir"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
