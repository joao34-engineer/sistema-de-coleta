import Link from "next/link";
import type { Route } from "next";
import type { DocumentListDTO } from "../api/delivery/contracts";
import { MobilePageHeader } from "@/shared/ui/mobile-page-header";
import { MobileBottomNav } from "@/shared/ui/mobile-bottom-nav";

type Props = Readonly<{
  collectionId: string;
  documents: ReadonlyArray<DocumentListDTO>;
}>;

export function CollectionDocumentsPage({ collectionId, documents }: Props) {
  const defaultDocs = [
    { title: "Guia de coleta", status: "Emitida", statusColor: "text-[var(--color-primary-dark)]" },
    { title: "Termo de entrada", status: "Pendente", statusColor: "text-[var(--color-text-muted)]" },
    { title: "Orçamento", status: "Aguardando", statusColor: "text-[#a36b2c]" },
  ];

  return (
    <main className="mx-auto min-h-screen w-full max-w-[390px] bg-[var(--color-surface-bg)] pb-28">
      <MobilePageHeader
        title="Documentos"
        subtitle={`Guia MJT-2026-000021`}
        backHref={"/coletas" as Route}
      />

      <div className="flex flex-col gap-4 px-6 pt-4">
        {documents.length > 0 ? (
          documents.map((doc) => (
            <div
              key={doc.id}
              className="flex flex-col gap-3 rounded-[16px] border border-[var(--color-border)] bg-[var(--color-card-bg)] p-4 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-[16px] font-semibold text-[var(--color-text-primary)]">
                  Guia de coleta (v{doc.version})
                </h3>
                <span className="text-[12px] font-semibold text-[var(--color-primary-dark)]">
                  Emitida
                </span>
              </div>

              <div className="flex items-center gap-3 border-t border-[var(--color-border)] pt-3 text-[11px] font-semibold text-[var(--color-text-muted)]">
                <Link href={`/coletas/${collectionId}/documentos/${doc.id}` as Route} className="hover:text-[var(--color-primary)]">
                  Ver
                </Link>
                <span>·</span>
                <a href={`/api/documents/${doc.id}/download?artifact=pdf`} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--color-primary)]">
                  Baixar
                </a>
                <span>·</span>
                <button type="button" onClick={() => window.print()} className="hover:text-[var(--color-primary)]">
                  Imprimir
                </button>
                <span>·</span>
                <button type="button" className="hover:text-[var(--color-primary)]">
                  Compartilhar
                </button>
              </div>
            </div>
          ))
        ) : (
          defaultDocs.map((doc) => (
            <div
              key={doc.title}
              className="flex flex-col gap-3 rounded-[16px] border border-[var(--color-border)] bg-[var(--color-card-bg)] p-4 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-[16px] font-semibold text-[var(--color-text-primary)]">
                  {doc.title}
                </h3>
                <span className={`text-[12px] font-semibold ${doc.statusColor}`}>
                  {doc.status}
                </span>
              </div>

              <div className="flex items-center gap-3 border-t border-[var(--color-border)] pt-3 text-[11px] font-semibold text-[var(--color-text-muted)]">
                <span className="cursor-pointer hover:text-[var(--color-primary)]">Ver</span>
                <span>·</span>
                <span className="cursor-pointer hover:text-[var(--color-primary)]">Baixar</span>
                <span>·</span>
                <span className="cursor-pointer hover:text-[var(--color-primary)]">Imprimir</span>
                <span>·</span>
                <span className="cursor-pointer hover:text-[var(--color-primary)]">Compartilhar</span>
              </div>
            </div>
          ))
        )}
      </div>

      <MobileBottomNav />
    </main>
  );
}

