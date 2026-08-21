import Link from "next/link";
import type { Route } from "next";
import type { DocumentListDTO } from "../api/delivery/contracts";
import { DocumentDeliveryActions } from "./document-delivery-actions";
import { WhatsAppShareButton } from "./whatsapp-share-button";
import { MobilePageHeader } from "@/shared/ui/mobile-page-header";
import { MobileBottomNav } from "@/shared/ui/mobile-bottom-nav";
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
    <main className="mx-auto min-h-screen w-full max-w-md bg-[var(--color-background)] pb-28">
      <MobilePageHeader
        title="Documentos"
        subtitle={`Guia ${collectionId.substring(0, 8)}`}
        backHref={"/coletas" as Route}
      />

      <div className="flex flex-col gap-4 px-4">
        {documents.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-[14px] font-semibold text-[var(--color-text)]">
              Nenhum documento disponível para esta coleta.
            </p>
            <p className="mt-1 text-[12px] text-[var(--color-muted)]">
              Os recibos e guias serão gerados assim que a coleta for finalizada.
            </p>
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            {documents.map((document) => {
              const hasPdf = document.artifacts.some((a) => a.type === "pdf");
              const hasQr = document.artifacts.some((a) => a.type === "qr");

              return (
                <Card key={document.id} className="flex flex-col gap-4 p-4">
                  <CardHeader className="p-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h2 className="text-[16px] font-semibold text-[var(--color-text)]">
                          Versão {document.version}
                        </h2>
                        <p className="text-[12px] text-[var(--color-muted)]">
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

                  <CardContent className="flex flex-col gap-3 p-0">
                    {/* Visualização Preview do QR Code (Se disponível) */}
                    {hasQr ? (
                      <div className="flex items-center gap-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-green)] p-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/documents/${document.id}/download?artifact=qr`}
                          alt="QR Code de Validação Pública"
                          className="h-16 w-16 rounded-[8px] border border-[var(--color-border)] bg-white p-1 object-contain"
                        />
                        <div className="flex flex-col">
                          <span className="text-[12px] font-semibold text-[var(--color-text)]">
                            QR Code de Autenticidade
                          </span>
                          <span className="text-[11px] text-[var(--color-muted)]">
                            Validação pública instantânea escaneando o código.
                          </span>
                        </div>
                      </div>
                    ) : null}

                    {/* Botões Principais de Ação */}
                    <div className="flex flex-wrap gap-2 border-t border-[var(--color-border)] pt-2">
                      {hasPdf ? (
                        <>
                          <Link href={`/coletas/${collectionId}/documentos/${document.id}` as Route}>
                            <Button variant="primary" size="sm" className="min-h-[38px] px-3">
                              👁️ Visualizar PDF
                            </Button>
                          </Link>
                          <a
                            href={`/api/documents/${document.id}/download?artifact=pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button variant="secondary" size="sm" className="min-h-[38px] px-3">
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
                          <Button variant="secondary" size="sm" className="min-h-[38px] px-3">
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
                    <div className="border-t border-[var(--color-border)] pt-3">
                      <DocumentDeliveryActions documentId={document.id} />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <MobileBottomNav />
    </main>
  );
}
