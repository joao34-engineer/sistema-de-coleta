"use client";

import { Button } from "@/shared/ui/button";

type Props = Readonly<{
  documentId: string;
  version: number;
  officialCode?: string;
}>;

export function WhatsAppShareButton({ documentId, version, officialCode }: Props) {
  const handleShare = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const codeText = officialCode ? ` (${officialCode})` : "";
    const text = `Olá! Segue o recibo de coleta MJT${codeText} - Versão ${version}.\nVocê pode verificar a autenticidade e baixar o PDF em:\n${origin}/api/documents/${documentId}/download?artifact=pdf`;

    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <Button variant="secondary" size="sm" type="button" onClick={handleShare}>
      📱 Compartilhar WhatsApp
    </Button>
  );
}
