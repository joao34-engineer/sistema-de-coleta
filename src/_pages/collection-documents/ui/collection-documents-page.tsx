import Link from "next/link";
import type { Route } from "next";
import type { DocumentListDTO } from "../api/delivery/contracts";
import { DocumentDeliveryActions } from "./document-delivery-actions";
import { WhatsAppShareButton } from "./whatsapp-share-button";
import { Button } from "@/shared/ui/button";
import { Card, CardHeader, CardContent } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";

type Props = Readonly<{
  collectionId: string;
  documents: ReadonlyArray<DocumentListDTO>;
}>;

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function CollectionDocumentsPage({ collectionId, documents }: Props) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-lg px-4 py-6">
      {/* Top Header Mobile */}
      <header className="mb-6">
        <Link
          href={"/coletas" as Route}
          className="text-xs font-semibold text-[var(--color-primary)] hover:underline"
        >
          ← Voltar às coletas
        </Link>
        <span className="mt-2 block text-xs font-bold uppercase tracking-wider text-[var(--color-primary)]">
          MJT · Recibos & Evidências
        </span>
        <h1 className="text-2xl font-bold text-[var(--color-text)]">
          Documentos da Coleta
        </h1>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          Versões emitidas são preservadas com imutabilidade e hash de integridade.
        </p>
      </header>

      {documents.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-sm font-semibold text-[var(--color-text)]">
            Nenhum documento disponível
          </p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Os recibos e guias serão gerados assim que a coleta for finalizada.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-5">
          {documents.map((document) => {
            const hasPdf = document.artifacts.some((a) => a.type === "pdf");
            const hasQr = document.artifacts.some((a) => a.type === "qr");

            return (
              <Card key={document.id} className="flex flex-col gap-4 p-5">
                <CardHeader className="p-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-base font-bold text-[var(--color-text)]">
                        Guia Emitida · Versão {document.version}
                      </h2>
                      <p className="text-xs text-[var(--color-muted)]">
                        Emitida em {formatDate(document.issuedAt)}
                      </p>
                    </div>
                    <Badge status="ready">
                      {document.status === "rendered"
                        ? "Artefato Pronto"
                        : document.status === "snapshot_ready"
                        ? "Aguardando PDF"
                        : document.status}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="p-0 flex flex-col gap-3">
                  {/* Visualização Preview do QR Code (Se disponível) */}
                  {hasQr ? (
                    <div className="flex items-center gap-3 rounded-md bg-[var(--color-surface-green)] p-3 border border-[var(--color-border)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/documents/${document.id}/download?artifact=qr`}
                        alt="QR Code de Validação Pública"
                        className="h-16 w-16 rounded border border-[var(--color-border)] bg-white p-1 object-contain"
                      />
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-[var(--color-text)]">
                          QR Code de Autenticidade
                        </span>
                        <span className="text-[11px] text-[var(--color-muted)]">
                          Permite a qualquer pessoa validar este recibo escaneando o código.
                        </span>
                      </div>
                    </div>
                  ) : null}

                  {/* Botões Principais de Ação */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--color-border)]">
                    {hasPdf ? (
                      <>
                        <Link href={`/coletas/${collectionId}/documentos/${document.id}` as Route}>
                          <Button variant="primary" size="sm">
                            👁️ Visualizar PDF
                          </Button>
                        </Link>
                        <a
                          href={`/api/documents/${document.id}/download?artifact=pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button variant="secondary" size="sm">
                            📥 Baixar PDF
                          </Button>
                        </a>
                      </>
                    ) : null}

                    {hasQr ? (
                      <a
                        href={`/api/documents/${document.id}/download?artifact=qr`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="secondary" size="sm">
                          🔍 Baixar QR
                        </Button>
                      </a>
                    ) : null}

                    <WhatsAppShareButton
                      documentId={document.id}
                      version={document.version}
                    />
                  </div>

                  {/* Ações Avançadas de Entrega/Reenvio por Email */}
                  <div className="mt-2 border-t border-[var(--color-border)] pt-3">
                    <DocumentDeliveryActions documentId={document.id} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <footer className="mt-8 border-t border-[var(--color-border)] pt-4 text-center">
        <p className="text-xs text-[var(--color-muted)]">
          ID interno da coleta: {collectionId}
        </p>
      </footer>
    </main>
  );
}
