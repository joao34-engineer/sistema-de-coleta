# Next.js App Router e PWA

## Regras do App Router

- Usar App Router; `app/` na raiz contem somente convencoes do Next.js: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`, `route.ts`, `manifest.ts` e metadados.
- Server Components sao padrao. Dados, autorizacao e composicao de paginas acontecem no servidor.
- Usar `'use client'` apenas na menor folha que necessita evento, estado, efeito, canvas de assinatura, camera ou Storage/Service Worker do navegador.
- Route Handlers e Server Actions recebem entrada hostil. Validar formato, tamanho e regras de negocio, depois autenticar e autorizar no servidor antes de executar uma mutacao.
- Mutacoes nao podem ser efeitos de renderizacao. Usar um comando/Action/handler explicito e idempotente.
- Proteger modulos de banco, secrets e administracao com `server-only`.

## Camada de acesso a dados

Centralizar queries e comandos server-only em `src/shared/db` ou modulo de dominio extraido. Cada operacao deve aplicar autorizacao proxima da fonte de dados e retornar um DTO minimo. A interface pode fazer verificacao otimista para UX, mas ela nunca substitui RLS nem verificacao segura no comando.

## PWA decidida

O sistema e online-first com continuidade de campo. O manifest define nome, icones, `display: standalone`, cores e `start_url`. O service worker armazena somente os recursos do aplicativo e dados explicitamente seguros para cache.

- Rascunhos locais podem conter dados de coleta pendente; proteger o dispositivo e excluir apos sincronizacao confirmada.
- Codigo oficial, PDF, evento de finalizacao e compartilhamento nascem somente no servidor apos sincronizacao.
- Mostrar estado claro: online, salvo localmente, sincronizando, sincronizado ou falhou.
- Atualizacao do service worker nao pode descartar rascunhos; avisar o usuario antes de recarregar quando houver trabalho pendente.
- Nao armazenar JWT, service role, PDF privado ou link assinado em cache de longa duracao.

## Fila offline de rascunhos (Chat 2)

Rascunhos de captura vivem em IndexedDB (`mjt-offline-v1`), com escopo por `userId`. A UI grava local primeiro e, se houver rede, drena a fila serial reusando as server actions existentes. O service worker nao participa do replay e continua sem cachear HTML, API ou PDF (ADR 0005 e ADR 0006).

- Wizard de captura permanece em `/coletas/nova`; a etapa corrente (`cliente` | `itens` | `revisao` | `assinatura`) e persistida no registro local.
- Estados visiveis: online, salvo localmente, sincronizando, sincronizado, falhou.
- Painel de pendentes no host PWA lista rascunhos locais, permite retry e retoma a etapa. Descarte local nao apaga guia oficial no servidor.
- `PwaShell.canReload` le um snapshot em memoria (pendente ou drain em voo → nao recarregar). O aviso de update menciona trabalho pendente antes da confirmacao.
- Sem JWT, service role, PDF ou link assinado no IndexedDB. Assinatura PNG e CPF/telefone sao apagados apos finalize confirmado.

## Cache e privacidade

Nao cachear resposta autenticada, documento privado, consulta de coleta, erro de autorizacao ou download assinado em CDN/public cache. Definir cache por rota/consulta e documentar invalidador e comportamento de falha. O service worker e servido com `Cache-Control: no-cache, no-store, must-revalidate` para atualizacoes confiaveis.

## Cabecalhos minimos

Aplicar CSP adequada aos hosts usados, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` ou `frame-ancestors 'none'`, `Referrer-Policy: strict-origin-when-cross-origin`, HSTS em producao HTTPS e Permissions-Policy bloqueando recursos nao usados. Revisar a CSP ao adicionar e-mail, analitica, fontes ou upload.

## Testes PWA

Testar instalacao em Android/iOS, inicio em modo standalone, conexao interrompida antes/depois da assinatura, reabertura com rascunho pendente, reenvio idempotente apos reconexao e atualizacao do service worker.

Fontes: [guia oficial PWA](https://nextjs.org/docs/app/guides/progressive-web-apps) e [seguranca de dados](https://nextjs.org/docs/app/guides/data-security).
