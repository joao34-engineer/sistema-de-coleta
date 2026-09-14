"use client";

import { useState } from "react";
import { Button } from "@/shared/ui/button";
import { buttonClassName } from "@/shared/lib/button-class-name";
import { DocumentDeliveryActions } from "./document-delivery-actions";

type Props = Readonly<{
  documentId: string;
  version: number;
  officialCode: string | null;
  pdfDownloadUrl: string;
}>;

export function DocumentViewerActions({
  documentId,
  version,
  officialCode,
  pdfDownloadUrl,
}: Props) {
  const [shareOpen, setShareOpen] = useState(false);

  return (
    <div className="flex w-full max-w-[342px] flex-col gap-3">
      <div className="flex w-full gap-3">
        <a
          href={pdfDownloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClassName({ variant: "secondary", size: "md", className: "flex-1" })}
        >
          Baixar PDF
        </a>
        <Button
          type="button"
          variant="primary"
          size="md"
          className="flex-1"
          onClick={() => setShareOpen(true)}
        >
          Compartilhar
        </Button>
      </div>
      {shareOpen ? (
        <DocumentDeliveryActions
          documentId={documentId}
          version={version}
          {...(officialCode === null ? {} : { officialCode })}
        />
      ) : null}
    </div>
  );
}
