---
name: mjt-nextjs-pwa
description: Implementar ou revisar telas, rotas, Route Handlers, Server Actions, Server/Client Components, cache, manifest, service worker e sincronização offline do Sistema de Coleta MJT. Use ao alterar Next.js App Router ou qualquer comportamento PWA e mobile-first deste projeto.
---

# MJT Next.js PWA

Construir interface mobile-first sem transformar o navegador em fonte de verdade documental.

## Leitura obrigatoria

Ler primeiro `../../../docs/nextjs-pwa.md`, `../../../docs/typescript.md`, `../../../docs/architecture/fsd.md` e `../../../docs/security.md`.

## Procedimento

1. Definir se a capacidade e pagina local ou reuso confirmado; aplicar FSD pages-first.
2. Criar rota fina em `app/` que reexporta/delega para `src/_pages` ou `src/_app/api-routes`.
3. Manter Server Component por padrao; isolar `'use client'` em folha interativa e passar somente DTO serializavel.
4. Validar toda entrada no servidor, autenticar e autorizar cada mutacao. Tratar Action e Route Handler como endpoint publico.
5. Definir cache explicitamente; dados autenticados, QR privado, PDF e erros nao entram em cache publico.
6. Para PWA, preservar rascunho local e fila de sincronizacao, mas reservar numero oficial, PDF e envio para o servidor apos confirmacao.
7. Testar interface, permissao, falha de rede, retry idempotente e atualizacao do service worker quando aplicavel.
8. Atualizar documento/ADR se mudar rota, cache, offline ou fronteira server/client.

## Regras essenciais

- Nunca importar `server-only` ou client administrativo em modulo client.
- Nunca usar `useEffect` para obter dados iniciais de pagina que podem ser carregados no servidor.
- Nao colocar `'use client'` no layout/pagina apenas por um botao ou campo interativo.
- Nao permitir que cache ou offline transforme rascunho em documento oficial.
- Manter feedback claro de sincronizacao e nao descartar rascunho durante update do app.

## Referencia

Use [checklist PWA](references/pwa-checklist.md) na revisao final.
