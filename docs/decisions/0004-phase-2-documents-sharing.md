# ADR 0004 — Documentos, compartilhamento e entrega da Fase 2

- Status: aceito para a Fase 2
- Data: 2026-08-20
- Escopo: snapshot documental, artefatos, renderização, links privados, entrega e revisão

## Contexto

Uma coleta finalizada é evidência operacional imutável. O sistema precisa produzir PDF/QR de forma recuperável, compartilhar o documento sem expor Storage ou dados pessoais e permitir correções sem sobrescrever versões anteriores.

## Decisões

1. **Snapshot e issuer.** A tabela `documents` mantém o snapshot da coleta, versão, hash, token de verificação e perfil institucional associado. O perfil de issuer e o logo são validados antes da emissão; mudanças futuras de configuração não reescrevem documentos emitidos.

2. **Artefatos privados.** PDF e QR ficam em `document_artifacts` e no bucket privado `collection-documents`. O registro guarda caminho interno, MIME, tamanho e SHA-256. Artefatos são append-only; não recebem atualização ou exclusão para representar falha.

3. **Renderização durável.** `document_jobs` usa lease, tentativas, `available_at`, `max_attempts` e RPCs server-side de claim/complete. O worker processa lote limitado, retoma leases expirados e marca falha permanente após esgotar tentativas. A geração não depende de uma requisição HTTP aberta.

4. **Compensação Postgres/Storage.** A intenção de upload vive em schema privado. O worker prepara a intenção, envia ao Storage e somente então confirma por RPC, que verifica MIME e existência do objeto antes de criar o artefato. Falha antes da confirmação pode cancelar/remover o objeto; registros já confirmados nunca são apagados como compensação.

5. **Links privados.** `document_shares` guarda somente hash SHA-256 do token aleatório. O token bruto aparece uma única vez na criação. Links expiram por padrão em sete dias, têm limite de downloads e são revogáveis; o contador é incrementado atomicamente no endpoint de download. A página não consome o limite ao ser atualizada.

6. **Entrega por e-mail.** `share_deliveries` registra canal, destinatário mascarado, resultado e referência do provedor. A chave `Idempotency-Key` participa da referência persistida e do request ao Resend. O adaptador é server-only, valida `RESEND_API_KEY`/`DOCUMENT_FROM_EMAIL` quando o envio real é habilitado e permanece dry-run por padrão; testes nunca fazem rede. **V1 (eixo 1.6):** com `DOCUMENT_EMAIL_SEND_ENABLED=true` o adaptador envia de fato via Resend; sem a flag (ou em `NODE_ENV=test`) continua dry-run. O corpo do e-mail aponta somente para `/d/{token}`.

7. **Revisão append-only.** A RPC `revise_collection_document` recebe `sourceDocumentId`, `expectedVersion`, patch tipado, motivo, tipo e chave de idempotência. Ela valida a versão corrente, herda o snapshot protegido, cria nova versão/hash/token, registra `document_revisions` e agenda novo job de PDF. A versão anterior não é alterada nem removida.

8. **Privacidade e cache.** Rotas autenticadas, links e erros usam `Cache-Control: no-store`. Downloads usam URL assinada curta e `Referrer-Policy: no-referrer`. Respostas públicas não incluem assinatura, PII, caminho de Storage, token ou hash.

## Consequências

- Retry de emissão é seguro porque jobs e comandos usam leases/idempotência; falhas permanentes permanecem auditáveis.
- Reenvio de e-mail não duplica a intenção quando a mesma chave é repetida.
- Correções aumentam a versão e exigem nova renderização, mantendo a cadeia documental.
- A limpeza de intents expiradas é uma operação separada e nunca trata `document_artifacts` como fila mutável.
- **V1 operacional:** o happy path é o kick in-process (`after()` + DAL) depois de finalize/cancel/reopen/revise. O cron em `vercel.json` chama `GET /api/internal/document-jobs/run` a cada 5 minutos (auth via `CRON_SECRET` Bearer ou `DOCUMENT_WORKER_SECRET`) só como retry. Sem artefato a UI declara “Gerando o PDF…” e depois um estado honesto. Compartilhamento WhatsApp/`navigator.share` usa apenas `/d/{token}`.

## Fora do escopo

Aplicação remota de migrations, envio real de e-mail por padrão (continua dry-run até flag explícita), alteração de documentos emitidos, exclusão de evidências e cache público de PDFs/links. Consumo de share antes da URL assinada (B28) permanece na Fase 4.

