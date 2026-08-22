import Link from "next/link";
import type { Route } from "next";
import type { DocumentListDTO } from "../api/delivery/contracts";
import { MobilePageHeader } from "@/shared/ui/mobile-page-header";
import { MobileBottomNav } from "@/shared/ui/mobile-bottom-nav";
import { MobileStatePanel } from "@/shared/ui/mobile-state-panel";
import { DocumentDeliveryActions } from "./document-delivery-actions";

type Props = Readonly<{
  collectionId: string;
  documents: ReadonlyArray<DocumentListDTO>;
  officialCode: string | null;
}>;

function formatIssuedAt(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export function CollectionDocumentsPage({ collectionId, documents, officialCode }: Props) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-[390px] bg-[var(--color-surface-bg)] pb-28">
      <MobilePageHeader
        title="Documentos"
        subtitle={officialCode ? `Guia ${officialCode}` : "Rascunho sem guia emitida"}
        backHref={"/coletas" as Route}
      />

      <div className="flex flex-col gap-4 px-6 pt-4">
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
          documents.map((doc) => (
            <div
              key={doc.id}
              className="flex flex-col gap-3 rounded-[16px] border border-[var(--color-border)] bg-[var(--color-card-bg)] p-4 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-[16px] font-semibold text-[var(--color-text-primary)]">
                  Versão {doc.version}
                </h3>
                <span className="text-[11px] font-normal text-[var(--color-text-muted)]">
                  {formatIssuedAt(doc.issuedAt)}
                </span>
              </div>

              <div className="flex items-center gap-3 border-t border-[var(--color-border)] pt-3 text-[11px] font-semibold text-[var(--color-text-muted)]">
                <Link href={`/coletas/${collectionId}/documentos/${doc.id}` as Route} className="hover:text-[var(--color-primary)]">
                  Ver
                </Link>
                {doc.artifacts.some((artifact) => artifact.type === "pdf") ? (
                  <>
                    <span>·</span>
                    <a href={`/api/documents/${doc.id}/download?artifact=pdf`} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--color-primary)]">
                      Baixar PDF
                    </a>
                  </>
                ) : null}
              </div>

              <DocumentDeliveryActions documentId={doc.id} />
            </div>
          ))
        )}
      </div>

      <MobileBottomNav />
    </main>
  );
}
