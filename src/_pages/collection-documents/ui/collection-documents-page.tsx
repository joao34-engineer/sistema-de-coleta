import Link from "next/link";
import type { Route } from "next";
import type { DocumentListDTO } from "../api/delivery/contracts";
import { MobilePageHeader } from "@/shared/ui/mobile-page-header";
import { MobileStatePanel } from "@/shared/ui/mobile-state-panel";
import { DocumentDeliveryActions } from "./document-delivery-actions";
import { PdfPendingStatus } from "./pdf-pending-status";
import { formatDateTimePtBr } from "@/shared/lib/format-date-time-pt-br";

type Props = Readonly<{
  collectionId: string;
  documents: ReadonlyArray<DocumentListDTO>;
  officialCode: string | null;
}>;

export function CollectionDocumentsPage({ collectionId, documents, officialCode }: Props) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[var(--color-surface-bg)] pb-[calc(5.25rem+env(safe-area-inset-bottom,0px)+1.5rem)]">
      <MobilePageHeader
        title="Documentos"
        subtitle={officialCode ? `Guia ${officialCode}` : "Rascunho sem guia emitida"}
        backHref={`/coletas/${collectionId}` as Route}
      />

      <div className="flex flex-col gap-4 px-6 pt-6">
        {documents.length === 0 ? (
          <MobileStatePanel
            type="empty"
            title="Nenhum documento disponível"
            subtitle={
              officialCode
                ? "Esta coleta ainda não tem guia emitida. Finalize o fluxo de assinatura para gerar o documento."
                : "Rascunho sem guia emitida. Finalize a coleta para gerar o documento."
            }
          />
        ) : (
          documents.map((doc) => {
            const hasPdf = doc.artifacts.some((artifact) => artifact.type === "pdf");
            return (
              <article
                key={doc.id}
                className="flex w-full max-w-[342px] flex-col gap-3 self-center rounded-[16px] border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-5 shadow-xs"
              >
                <div>
                  <h2 className="text-[16px] font-semibold leading-6 text-[var(--color-text-primary)]">
                    Guia de coleta
                  </h2>
                  <p className="mt-1 text-[12px] leading-4 text-[var(--color-text-muted)]">
                    Versão {doc.version} · Emitida · {formatDateTimePtBr(doc.issuedAt)}
                  </p>
                </div>

                <p className="text-[11px] font-semibold leading-4 text-[var(--color-primary-strong)]">
                  <Link
                    href={`/coletas/${collectionId}/documentos/${doc.id}` as Route}
                    className="hover:underline"
                  >
                    Ver
                  </Link>
                  {hasPdf ? (
                    <>
                      {" · "}
                      <a
                        href={`/api/documents/${doc.id}/download?artifact=pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        Baixar
                      </a>
                    </>
                  ) : null}
                </p>

                <PdfPendingStatus
                  collectionId={collectionId}
                  documentId={doc.id}
                  hasPdf={hasPdf}
                  {...(doc.pdfJobStatus === undefined ? {} : { pdfJobStatus: doc.pdfJobStatus })}
                />

                {hasPdf ? (
                  <DocumentDeliveryActions
                    documentId={doc.id}
                    version={doc.version}
                    officialCode={officialCode}
                  />
                ) : null}
              </article>
            );
          })
        )}
      </div>

    </main>
  );
}
