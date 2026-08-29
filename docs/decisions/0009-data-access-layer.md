# ADR 0009 — Data Access Layer unica

## Status

Aceita em 2026-08-29. **Congelada.** Nao reabrir sem pedido explicito do humano.

## Contexto

O guia oficial de [Data Security](https://nextjs.org/docs/app/guides/data-security) do Next.js descreve tres abordagens de busca de dados e pede escolher uma so:

1. HTTP APIs — apps com backend separado ou legado.
2. Data Access Layer (DAL) — projetos novos.
3. Acesso no componente — prototipo.

`sistema-coleta` e um app novo (Next.js 16, App Router, TypeScript, Supabase no mesmo processo). Trechos da Fase 1 ainda misturam a abordagem 2 com a 1 (Server Action que fabrica `Request` e chama funcao HTTP-shaped). Deixar o catalogo das tres abordagens como se fosse escolha em aberto confunde agentes e reabre o debate a cada tarefa.

## Decisao

**A unica abordagem vigente e o Data Access Layer.**

- Leituras: `src/_pages/<slice>/api/queries.ts` (`server-only`), sessao em `src/shared/auth`.
- Mutacoes: `src/_pages/<slice>/api/commands.ts` (`server-only`).
- Server Actions (`"use server"`) e Route Handlers (`app/**/route.ts`) sao adaptadores finos: validam entrada, chamam o DAL, traduzem DTO/erro. Nao contem SQL/RPC/Storage.
- Route Handlers do contrato [`http-api.md`](../http-api.md), jobs internos e rotas publicas (QR, download) **permanecem**. Eles nao sao uma segunda abordagem de dados: delegam ao mesmo DAL.
- Regras criticas continuam no PostgreSQL (RPC + RLS). O DAL nao duplica o motor de negocio.

## Proibido

- Server Component ou Server Action fazer `fetch` da propria `/api`.
- Fabricar `new Request("http://localhost/...")` para chamar o dominio.
- Query Supabase / `process.env` secreto / `service_role` em Client Component ou no corpo de `page.tsx`.
- Tratar o catalogo das tres abordagens do Next.js como menu ainda aberto.
- Generic repository ou pasta `dal/` paralela ao FSD “por higiene”.

## Consequencias

- Codigo novo segue o padrao de `collection-operations` (comando tipado → action/rota fina).
- Fechar o gap da Fase 1 (customers/drafts HTTP-shaped) e migracao planejada; ver [`architecture-improvement.md`](../design-patterns/architecture-improvement.md). A migracao nao autoriza rewrite espontaneo.
- Auditores e agentes olham o DAL + RLS; a UI itera em cima de DTOs.

## Fontes

- [Next.js Data Security — Data Access Layer](https://nextjs.org/docs/app/guides/data-security)
- [Next.js Authentication — Creating a DAL](https://nextjs.org/docs/app/guides/authentication)
- [`AGENTS.md`](../../AGENTS.md)
