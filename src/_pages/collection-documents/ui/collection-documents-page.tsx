import Link from "next/link";
import type { DocumentListDTO } from "../api/delivery/contracts";
import { DocumentDeliveryActions } from "./document-delivery-actions";

type Props = Readonly<{ collectionId: string; documents: ReadonlyArray<DocumentListDTO> }>;

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function CollectionDocumentsPage({ collectionId, documents }: Props) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-8">
      <header className="mb-6">
        <Link href="/dashboard" className="text-sm font-semibold text-primary">← Dashboard</Link>
        <p className="mt-5 text-sm font-semibold uppercase tracking-wide text-primary">Documentos da coleta</p>
        <h1 className="mt-1 text-3xl font-semibold">Guias e versões</h1>
        <p className="mt-2 text-sm text-muted">Versões emitidas são preservadas; links privados podem ser revogados.</p>
      </header>
      {documents.length === 0 ? <section className="rounded-medium border border-border bg-surface p-6"><p className="text-sm text-muted">Nenhum documento disponível para esta coleta.</p></section> : <div className="grid gap-4">{documents.map((document) => <article key={document.id} className="rounded-medium border border-border bg-surface p-5 shadow-surface"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">Versão {document.version}</h2><p className="mt-1 text-sm text-muted">Emitida em {formatDate(document.issuedAt)} · {document.status}</p></div><span className="rounded-full bg-background px-3 py-1 text-xs font-semibold text-muted">{document.artifacts.length > 0 ? "Artefato pronto" : "Aguardando geração"}</span></div><div className="mt-4 flex flex-wrap gap-2">{document.artifacts.some((artifact) => artifact.type === "pdf") ? <a href={`/api/documents/${document.id}/download?artifact=pdf`} className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white">Baixar PDF</a> : null}{document.artifacts.some((artifact) => artifact.type === "qr") ? <a href={`/api/documents/${document.id}/download?artifact=qr`} className="rounded-md border border-border px-3 py-2 text-sm font-semibold">Baixar QR</a> : null}</div><DocumentDeliveryActions documentId={document.id} /></article>)}</div>}
      <p className="mt-6 text-xs text-muted">ID da coleta: {collectionId}</p>
    </main>
  );
}

