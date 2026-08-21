"use client";

import { useState } from "react";

type Props = Readonly<{ documentId: string }>;

export function DocumentDeliveryActions({ documentId }: Props) {
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
      const response = await fetch(`/api/documents/${documentId}/shares`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shareType: "pdf", maxDownloads: 20, expiresAt: null }) });
      const body: unknown = await response.json();
      if (!response.ok || typeof body !== "object" || body === null || !("data" in body)) throw new Error("share_failed");
      const data = body.data;
      if (typeof data !== "object" || data === null || !("token" in data) || typeof data.token !== "string" || !("shareId" in data) || typeof data.shareId !== "string") throw new Error("share_failed");
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
      const response = await fetch(`/api/documents/shares/${shareId}/email`, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ email, shareToken }) });
      if (!response.ok) throw new Error("email_failed");
      setMessage("Envio registrado em modo de preparação.");
    } catch {
      setMessage("Não foi possível preparar o e-mail.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-small border border-border bg-background p-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void createShare()} disabled={busy} className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">Criar link seguro</button>
        {shareUrl ? <a href={shareUrl} className="rounded-md border border-border px-3 py-2 text-sm font-semibold" target="_blank" rel="noreferrer">Abrir link</a> : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <label className="sr-only" htmlFor={`share-email-${documentId}`}>E-mail do destinatário</label>
        <input id={`share-email-${documentId}`} type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="destinatario@exemplo.com" className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm" />
        <button type="button" onClick={() => void sendEmail()} disabled={busy || email.length === 0} className="rounded-md border border-border px-3 py-2 text-sm font-semibold disabled:opacity-60">Preparar e-mail</button>
      </div>
      {message ? <p className="mt-2 text-xs text-muted" role="status">{message}</p> : null}
    </div>
  );
}
