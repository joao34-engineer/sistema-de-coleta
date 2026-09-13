import { collectionStatusLabel } from "@/entities/collection";
import type { PublicVerificationDTO } from "../model/public-verification";
import { PublicVerificationChrome } from "./public-verification-chrome";

type Props = Readonly<{ verification: PublicVerificationDTO | null }>;

const PRIVACY_FOOTNOTE =
  "Para preservar a privacidade, esta consulta não exibe dados pessoais, itens, valores, endereço, fotos ou assinaturas.";

export function PublicVerificationPage({ verification }: Props) {
  if (!verification) {
    return (
      <PublicVerificationChrome
        headerSubtitle="Código inválido"
        icon="!"
        iconTone="error"
        title="Guia não encontrada"
        description="Não foi possível confirmar este código."
        fields={[
          { label: "CÓDIGO CONSULTADO", value: "—" },
          { label: "STATUS", value: "Não disponível" },
        ]}
        footnote="A consulta não revela nenhum dado adicional."
      />
    );
  }

  const canceled = verification.status === "canceled";
  const authentic = verification.authentic && !canceled;
  const statusValue = collectionStatusLabel[verification.status];

  if (canceled) {
    return (
      <PublicVerificationChrome
        headerSubtitle="Guia cancelada"
        icon="✕"
        iconTone="error"
        title="Guia cancelada"
        description="Esta guia permanece verificável no histórico imutável, mas foi cancelada."
        fields={[
          { label: "CÓDIGO DA GUIA", value: verification.officialCode, emphasize: true },
          { label: "STATUS", value: statusValue },
        ]}
        footnote={PRIVACY_FOOTNOTE}
      />
    );
  }

  if (authentic) {
    return (
      <PublicVerificationChrome
        headerSubtitle="Guia verificada"
        icon="✓"
        iconTone="success"
        title="Guia verificada"
        description="Este documento existe e está armazenado pela MJT."
        fields={[
          { label: "CÓDIGO DA GUIA", value: verification.officialCode, emphasize: true },
          { label: "STATUS", value: statusValue, emphasize: true },
        ]}
        footnote={PRIVACY_FOOTNOTE}
      />
    );
  }

  return (
    <PublicVerificationChrome
      headerSubtitle="Guia não autenticada"
      icon="!"
      iconTone="error"
      title="Guia não autenticada"
      description="Não foi possível confirmar a autenticidade deste documento."
      fields={[
        { label: "CÓDIGO DA GUIA", value: verification.officialCode, emphasize: true },
        { label: "STATUS", value: statusValue },
      ]}
      footnote={PRIVACY_FOOTNOTE}
    />
  );
}
