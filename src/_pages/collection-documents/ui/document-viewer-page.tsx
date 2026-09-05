import Link from "next/link";
import type { Route } from "next";
import { Button } from "@/shared/ui/button";
import { Card, CardHeader, CardContent } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { PdfPendingStatus } from "./pdf-pending-status";
import type { DocumentJobStatus } from "../api/delivery/contracts";

type Props = Readonly<{
  collectionId: string;
  documentId: string;
  hasPdf: boolean;
  pdfJobStatus?: DocumentJobStatus;
}>;

export function DocumentViewerPage({ collectionId, documentId, hasPdf, pdfJobStatus }: Props) {
  const pdfDownloadUrl = `/api/documents/${documentId}/download?artifact=pdf`;
  const failed = !hasPdf && pdfJobStatus === "failed";

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-4 py-6 flex flex-col">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <Link
            href={`/coletas/${collectionId}/documentos` as Route}
            className="text-xs font-semibold text-[var(--color-primary)] hover:underline"
          >
            ← Voltar aos documentos
          </Link>
          <h1 className="mt-1 text-xl font-bold text-[var(--color-text)]">
            Visualizador de PDF
          </h1>
        </div>
        {hasPdf ? (
          <a href={pdfDownloadUrl} download target="_blank" rel="noopener noreferrer">
            <Button variant="primary" size="sm">
              Baixar
            </Button>
          </a>
        ) : null}
      </header>

      <Card className="flex flex-1 flex-col overflow-hidden p-0">
        <CardHeader className="border-b border-[var(--color-border)] p-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-primary)]">
                Recibo Imutável
              </span>
              <p className="text-xs text-[var(--color-muted)]">
                ID do Documento: {documentId}
              </p>
            </div>
            <Badge status={hasPdf ? "ready" : failed ? "rejected" : "draft"}>
              {hasPdf ? "Integridade Preservada" : failed ? "Falha na geração" : "Gerando PDF"}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="flex flex-1 flex-col p-0 min-h-[500px]">
          {hasPdf ? (
            <iframe
              src={pdfDownloadUrl}
              title="Visualizador de PDF da Coleta MJT"
              className="h-full w-full border-0 min-h-[500px]"
            />
          ) : (
            <div className="flex flex-1 items-center justify-center p-4">
              <PdfPendingStatus
                collectionId={collectionId}
                documentId={documentId}
                hasPdf={hasPdf}
                pdfJobStatus={pdfJobStatus}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
