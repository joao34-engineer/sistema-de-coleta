"use client";

import { useState } from "react";
import { Button } from "@/shared/ui/button";
import { WhatsAppShareButton } from "./whatsapp-share-button";
import { maskRecipientEmail } from "../model/mask-recipient-email";

type Props = Readonly<{
  documentId: string;
  version: number;
  officialCode?: string | null;
}>;

function emailStatusMessage(providerReference: string | null | undefined): string {
  if (typeof providerReference === "string" && providerReference.startsWith("resend:")) {
    return "E-mail enviado ao provedor.";
  }
  if (typeof providerReference === "string" && providerReference.startsWith("dry-run:")) {
    return "Envio registrado em modo de preparação.";
  }
  return "Envio registrado.";
}

function readProviderReference(body: unknown): string | null {
  if (typeof body !== "object" || body === null || !("data" in body)) return null;
  const data = body.data;
  if (typeof data !== "object" || data === null || !("delivery" in data)) return null;
  const delivery = data.delivery;
  if (typeof delivery !== "object" || delivery === null || !("providerReference" in delivery)) return null;
  return typeof delivery.providerReference === "string" ? delivery.providerReference : null;
}

export function DocumentDeliveryActions({ documentId, version, officialCode }: Props) {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareId, setShareId] = useState<string | null>(null);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function createShare(): Promise<void> {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/documents/${documentId}/shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shareType: "pdf", maxDownloads: 20, expiresAt: null }),
      });
      const body: unknown = await response.json();
      if (!response.ok || typeof body !== "object" || body === null || !("data" in body)) {
        throw new Error("share_failed");
      }
      const data = body.data;
      if (
        typeof data !== "object" ||
        data === null ||
        !("token" in data) ||
        typeof data.token !== "string" ||
        !("shareId" in data) ||
        typeof data.shareId !== "string"
      ) {
        throw new Error("share_failed");
      }
      setShareId(data.shareId);
      setShareToken(data.token);
      const url = `${window.location.origin}/d/${data.token}`;
      setShareUrl(url);
      setMessage("Link seguro criado.");
    } catch {
      setMessage("Não foi possível criar o link.");
    } finally {
      setBusy(false);
    }
  }

  async function sendEmail(): Promise<void> {
    if (!email) return;
    setBusy(true);
    setMessage(null);
    try {
      if (!shareUrl || !shareId || !shareToken) throw new Error("share_required");
      const response = await fetch(`/api/documents/shares/${shareId}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ email, shareToken }),
      });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error("email_failed");
      setMessage(emailStatusMessage(readProviderReference(body)));
      setEmail(maskRecipientEmail(email));
    } catch {
      setMessage("Não foi possível preparar o e-mail.");
    } finally {
      setBusy(false);
    }
  }

  const emailFieldId = `share-email-${documentId}`;

  return (
    <div className="flex flex-col gap-3 border-t border-[var(--color-border)] pt-4">
      <p className="text-[13px] leading-5 text-[var(--color-text-muted)]">
        Crie o link seguro, envie e-mail ou compartilhe. Só a guia de coleta tem PDF.
      </p>

      <div className="flex flex-col gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => void createShare()} disabled={busy}>
          Criar link seguro
        </Button>
        {shareUrl ? (
          <a
            href={shareUrl}
            className="inline-flex min-h-[38px] items-center justify-center rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[12px] font-semibold text-[var(--color-text)] shadow-xs"
            target="_blank"
            rel="noreferrer"
          >
            Abrir link
          </a>
        ) : null}
        {shareUrl ? (
          <WhatsAppShareButton
            shareUrl={shareUrl}
            version={version}
            {...(officialCode ? { officialCode } : {})}
          />
        ) : null}
      </div>

      <label htmlFor={emailFieldId} className="text-[12px] font-semibold text-[var(--color-text-primary)]">
        Destinatário *
      </label>
      <input
        id={emailFieldId}
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="destinatario@exemplo.com"
        autoComplete="email"
        className="h-12 w-full rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-[14px] text-[var(--color-text-primary)]"
      />
      <p className="text-[11px] leading-4 text-[var(--color-text-muted)]">
        O endereço aparece mascarado após o envio.
      </p>

      <Button
        type="button"
        variant="primary"
        size="md"
        onClick={() => void sendEmail()}
        disabled={busy || email.length === 0 || !shareUrl}
      >
        Enviar e-mail
      </Button>
      {message ? (
        <p className="text-[12px] text-[var(--color-text-muted)]" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
