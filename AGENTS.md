# Governanca — Sistema de Coleta MJT

Este arquivo e a fonte normativa local para agentes e desenvolvedores no repositorio `sistema-coleta`. O projeto e independente do monorepo que o abriga: nao compartilhar banco, credenciais, deploy, dependencias ou contratos com os projetos de afiliados.

## Preflight obrigatorio

Antes de editar codigo, configuracao, migration ou infraestrutura:

1. Ler este arquivo.
2. Ler `docs/README.md`.
3. Ler o documento tematico indicado para a tarefa.
4. Carregar a skill local aplicavel, quando houver.
5. Confirmar que a mudanca pertence a fase aprovada ou obter decisao registrada antes de expandir escopo.

## Leis inegociaveis

- Nao apagar, zerar, recriar ou sobrescrever dados de producao, PDFs, assinaturas, evidencias ou eventos de auditoria.
- Toda mudanca de schema e aditiva, versionada por migration, revisavel e testada fora de producao antes de aplicar.
- Coleta finalizada e documento emitido nao sao excluidos nem alterados silenciosamente. Correcao gera evento e, se mudar a guia, uma nova versao.
- Zero `any`, `@ts-ignore`, `@ts-expect-error` e non-null assertion para mascarar incerteza. Dados externos entram como `unknown` e sao validados.
- Chaves secretas, service role, links privados e dados pessoais nao podem ir para Client Components, logs ou respostas publicas.
- RLS e politicas de Storage sao obrigatorios; esconder uma acao na interface nunca e autorizacao.
- Server Actions e Route Handlers sao endpoints publicos: validar entrada, autenticar e autorizar cada chamada no servidor.
- Server Components sao o padrao. Adicionar `'use client'` somente na menor fronteira que realmente exige eventos, estado, efeitos ou APIs do navegador.
- O aplicativo e App Router. Os arquivos em `app/` sao rotas finas; composicao e regra de negocio vivem em `src/` segundo FSD.
- Nao criar `entities`, `features` ou `widgets` por antecipacao. Comecar em `src/_pages` e extrair somente apos reuso real e fronteira estavel.

## Arquitetura aprovada

- Next.js App Router + TypeScript em modo estrito + PWA.
- Supabase: Auth, PostgreSQL, Storage privado e RLS.
- FSD adaptado a Next: `app/` na raiz e `src/_app`, `src/_pages`, `src/shared`; demais camadas so quando justificadas.
- Camada de acesso a dados no servidor, DTOs minimos na fronteira com o cliente e comandos idempotentes para mutacoes criticas.

Consulte `docs/architecture/fsd.md`, `docs/supabase.md`, `docs/nextjs-pwa.md` e `docs/security.md` antes de decidir detalhes.

## Leitura por tarefa

| Tarefa | Leitura adicional obrigatoria | Skill |
| --- | --- | --- |
| Tela, rota, Server/Client Component ou PWA | `docs/nextjs-pwa.md`, `docs/typescript.md`, `docs/architecture/fsd.md` | `$mjt-nextjs-pwa` |
| Tabela, migration, Auth, RLS, Storage ou geracao de tipos | `docs/supabase.md`, `docs/security.md`, `docs/architecture/data-and-rules.md` | `$mjt-supabase` |
| Nova regra de negocio ou organizacao de codigo | `docs/coding-standards.md`, `docs/architecture/fsd.md` | — |
| Documento, assinatura, QR ou compartilhamento | `docs/security.md`, `docs/architecture/data-and-rules.md`, fase 2 | — |
| Testes ou CI | `docs/testing.md` e doc da capacidade alterada | — |
| Deploy, backup, incidente ou acesso | `docs/security.md`, fase 4 | — |

## Validacao minima

Em qualquer alteracao aplicavel, executar `lint`, `tsc --noEmit`, testes relevantes e build. Para mudancas Supabase, testar permissoes com papeis corretos e incorretos; para PWA, testar reconexao e atualizacao do service worker.

## Atualizacao documental

Atualizar o documento tematico, ADR ou fase correspondente quando uma decisao, contrato, permissao, ambiente ou comportamento operacional mudar. Manter documentos de execucao abaixo de 500 linhas.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
