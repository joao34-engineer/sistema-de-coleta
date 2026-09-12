# ADR 0005 — Casca PWA: service worker estático e cache só de shell

- Status: aceito para a Fase 4, Chat 1
- Data: 2026-08-26
- Escopo: manifest, service worker, cache de shell, instalação e atualização

## Contexto

O Coleta MJT precisa ser instalável e abrir em `standalone` no campo. HTML autenticado, APIs, PDFs e links `/d/` não podem entrar em cache de longa duração. Serwist/Workbox aumentaria dependência e superfície sem ganho nesta casca.

## Decisões

1. **Service worker estático.** `public/sw.js` é o worker, sem Serwist. O contrato (`mjt-shell-v1`, `SKIP_WAITING`, URL `/sw.js`) vive em `src/shared/lib/pwa/service-worker-protocol.ts`. A política TypeScript em `shell-cache-policy.ts` é a fonte de verdade; o SW replica a mesma regra.

2. **Cache só de shell.** Cache-first apenas para `/_next/static/` e `/icons/`. Network-only para `/api/`, `.pdf`, `/d/`, `/verificar/`, documentos HTML, pedidos cross-origin e métodos que não sejam GET.

3. **Atualização com confirmação.** O `install` não chama `skipWaiting()`. A página envia `SKIP_WAITING` depois que o operador confirma o banner. Um reload silencioso não deve descartar trabalho futuro.

4. **Instalação.** Manifest com `display: standalone` e ícones, incluindo `apple-touch-icon` 180×180. Prompt Android via `beforeinstallprompt`. iPhone Safari: Compartilhar → Adicionar à Tela de Início. Chrome, Firefox e Edge no iOS: instrução para abrir no Safari (único caminho de ícone standalone). Sem fila, IndexedDB ou backup neste chat.

## Consequências

- O app instala e atualiza com consentimento, sem cachear HTML, API ou PDF.
- No iPhone, `beforeinstallprompt` não existe; o ícone real só nasce no Safari. Outros navegadores iOS só encaminham para o Safari.
- Fila offline, observabilidade e testes de campo permanecem nos chats seguintes.

## Fora do escopo

Serwist/Workbox, cache de documentos HTML, IndexedDB, fila de sync, JWT/PDF/link assinado em cache.
