"use client";

import { Button } from "@/shared/ui/button";

type Props = Readonly<{
  shareUrl: string;
  version: number;
  officialCode?: string;
}>;

function buildShareText(shareUrl: string, version: number, officialCode: string | undefined): string {
  const codeText = officialCode ? ` (${officialCode})` : "";
  return `Olá! Segue o recibo de coleta MJT${codeText} - Versão ${version}.\nVocê pode verificar a autenticidade e baixar o PDF em:\n${shareUrl}`;
}

export function WhatsAppShareButton({ shareUrl, version, officialCode }: Props) {
  const handleShare = async () => {
    const text = buildShareText(shareUrl, version, officialCode);

    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ url: shareUrl, text });
        return;
      } catch {
        // User cancelled or share failed — fall through to WhatsApp / copy.
      }
    }

    if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        // Clipboard may be denied; wa.me still opens with the text.
      }
    }

    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <Button variant="secondary" size="sm" type="button" onClick={() => void handleShare()}>
      Compartilhar
    </Button>
  );
}

export { buildShareText };
