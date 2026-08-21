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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-md bg-white shadow-2xl rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between border-b p-4">
          <h2 className="text-base font-bold text-gray-900">
            {action === "cancel" ? "⚠️ Cancelar Coleta Auditada" : "🔄 Reabrir Coleta Cancelada"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 font-bold text-lg">
            ✕
          </button>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <p className="text-xs text-gray-600">
            {action === "cancel"
              ? "O cancelamento registrará um evento imutável na timeline de auditoria. O código oficial da coleta não será reutilizado."
              : "A reabertura restaurará a coleta para seu estado operacional anterior, gerando novo registro de auditoria."}
          </p>

          <div className="flex rounded-xl bg-gray-100 p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setAction("cancel")}
              className={`w-1/2 py-1.5 rounded-lg transition-all ${action === "cancel" ? "bg-white text-red-700 shadow-sm" : "text-gray-600"}`}
            >
              Cancelar Coleta
            </button>
            <button
              type="button"
              onClick={() => setAction("reopen")}
              className={`w-1/2 py-1.5 rounded-lg transition-all ${action === "reopen" ? "bg-white text-[var(--color-primary-strong)] shadow-sm" : "text-gray-600"}`}
            >
              Reabrir Coleta
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <input type="hidden" name="collectionId" value={collectionId} />
            <input type="hidden" name="expectedVersion" value={expectedVersion} />

            <div>
              <label htmlFor="reason" className="mb-1 block text-xs font-semibold text-gray-700">
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
                    : "Ex: Cancelamento efetuado por engano no terminal mobile..."
                }
                className="w-full rounded-xl border border-gray-300 p-3 text-xs focus:border-[var(--color-primary)] focus:outline-none"
              />
            </div>

            {errorMsg && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-2.5 text-xs text-red-700 font-medium">
                {errorMsg}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={onClose} className="w-1/2 text-xs h-10">
                Voltar / Fechar
              </Button>
              <Button
                type="submit"
                variant={action === "cancel" ? "danger" : "primary"}
                isLoading={isSubmitting}
                className="w-1/2 text-xs h-10 font-semibold"
              >
                {action === "cancel" ? "Confirmar Cancelamento" : "Confirmar Reabertura"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
