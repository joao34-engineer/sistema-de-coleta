import type { Route } from "next";
import { MobilePageHeader } from "@/shared/ui/mobile-page-header";
import { PdfPendingStatus } from "./pdf-pending-status";
import { LazyPdfPreview } from "./lazy-pdf-preview";
import {
  CollectionDocumentLetterhead,
  type LetterheadItem,
} from "./collection-document-letterhead";
import { DocumentViewerActions } from "./document-viewer-actions";
import type { DocumentJobStatus } from "../api/delivery/contracts";

type Props = Readonly<{
  collectionId: string;
  documentId: string;
  hasPdf: boolean;
  officialCode: string | null;
  version: number | null;
  pdfJobStatus?: DocumentJobStatus;
  customerName?: string | null;
  locationDescription?: string | null;
  items?: ReadonlyArray<LetterheadItem>;
  signerName?: string | null;
}>;

export function DocumentViewerPage({
  collectionId,
  documentId,
  hasPdf,
  officialCode,
  version,
  pdfJobStatus,
  customerName = null,
  locationDescription = null,
  items = [],
  signerName = null,
}: Props) {
  const pdfDownloadUrl = `/api/documents/${documentId}/download?artifact=pdf`;

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[var(--color-surface-bg)] pb-[calc(5.25rem+env(safe-area-inset-bottom,0px)+1.5rem)]">
      <MobilePageHeader
        title="Guia de coleta"
        subtitle="Visualização"
        backHref={`/coletas/${collectionId}/documentos` as Route}
      />

      <div className="flex flex-col items-center gap-4 px-6 pt-6">
        <CollectionDocumentLetterhead
          officialCode={officialCode}
          version={version}
          customerName={customerName}
          locationDescription={locationDescription}
          items={items}
          signerName={signerName}
        />

        {hasPdf && version !== null ? (
          <DocumentViewerActions
            documentId={documentId}
            version={version}
            officialCode={officialCode}
            pdfDownloadUrl={pdfDownloadUrl}
          />
        ) : (
          <PdfPendingStatus
            collectionId={collectionId}
            documentId={documentId}
            hasPdf={hasPdf}
            {...(pdfJobStatus === undefined ? {} : { pdfJobStatus })}
          />
        )}

        {hasPdf ? (
          <LazyPdfPreview src={pdfDownloadUrl} title="Visualizador de PDF da Coleta MJT" />
        ) : null}
      </div>

    </main>
  );
}
