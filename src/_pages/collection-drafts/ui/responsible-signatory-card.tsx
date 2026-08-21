"use client";

import { useState } from "react";
import { Button } from "@/shared/ui/button";
import { Card, CardHeader, CardContent } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";

interface ResponsibleSignatoryCardProps {
  readonly initialName?: string | null;
  readonly initialTaxId?: string | null;
  readonly onSave?: (data: { responsibleName: string; responsibleTaxId: string | null }) => Promise<void>;
  readonly readOnly?: boolean;
}

export function ResponsibleSignatoryCard({
  initialName = "",
  initialTaxId = "",
  onSave,
  readOnly = false,
}: ResponsibleSignatoryCardProps) {
  const [responsibleName, setResponsibleName] = useState(initialName ?? "");
  const [responsibleTaxId, setResponsibleTaxId] = useState(initialTaxId ?? "");
  const [isEditing, setIsEditing] = useState(!initialName);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!responsibleName.trim()) {
      setError("O nome do responsável é obrigatório.");
      return;
    }

    if (!onSave) {
      setIsEditing(false);
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      await onSave({
        responsibleName: responsibleName.trim(),
        responsibleTaxId: responsibleTaxId.trim() ? responsibleTaxId.trim() : null,
      });
      setIsEditing(false);
    } catch {
      setError("Falha ao salvar os dados do responsável.");
    } finally {
      setIsSaving(false);
    }
  }

  if (readOnly || (!isEditing && responsibleName)) {
    return (
      <Card className="bg-[var(--color-card-bg,#ffffff)] shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary,#111827)]">
            Responsável Pela Entrega (Origem)
          </h3>
          {!readOnly && onSave && (
            <button
              className="text-xs font-semibold text-[var(--color-primary,#4c916f)] hover:underline"
              onClick={() => setIsEditing(true)}
              type="button"
            >
              Editar
            </button>
          )}
        </CardHeader>
        <CardContent className="space-y-1 text-xs">
          <p className="font-medium text-[var(--color-text-primary,#111827)]">
            {responsibleName || "Não informado"}
          </p>
          {responsibleTaxId && (
            <p className="text-[var(--color-text-muted,#6b7280)]">
              CPF/CNPJ: {responsibleTaxId}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-[var(--color-card-bg,#ffffff)] shadow-sm">
      <CardHeader className="pb-2">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary,#111827)]">
          Responsável Pela Entrega na Origem *
        </h3>
        <p className="text-xs text-[var(--color-text-muted,#6b7280)]">
          Informe o nome e documento da pessoa autorizada a entregar as peças no local de coleta.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <div className="rounded-lg bg-red-50 p-2 text-xs font-medium text-red-700">
            {error}
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-primary,#111827)] mb-1">
            Nome Completo do Responsável *
          </label>
          <Input
            placeholder="Ex: Carlos Eduardo Silva"
            value={responsibleName}
            onChange={(e) => setResponsibleName(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-primary,#111827)] mb-1">
            CPF ou CNPJ (Opcional)
          </label>
          <Input
            placeholder="Ex: 000.000.000-00"
            value={responsibleTaxId}
            onChange={(e) => setResponsibleTaxId(e.target.value)}
          />
        </div>
        <div className="flex justify-end pt-1">
          <Button
            className="min-h-[44px]"
            isLoading={isSaving}
            type="button"
            variant="primary"
            onClick={() => void handleSave()}
          >
            Confirmar Responsável
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
