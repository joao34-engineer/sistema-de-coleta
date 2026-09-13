# ADR 0011 — Slice `entities/collection`

## Status

Aceita em 2026-09-13.

## Contexto

Fases A–G de [`architecture-improvement.md`](../design-patterns/architecture-improvement.md) fecharam a DAL, o mapper de erro, primitivos de arquivo, `app/` fino no hub/oficina, `cache()` de sessao/detalhe, API publica das slices e higiene pontual.

O modelo de status da coleta (`CollectionStatus`, filtros da listagem, labels) vivia em `src/shared/model/collection-status.ts`. [`fsd.md`](../architecture/fsd.md) proibe regra de negocio de coleta em `shared/`. O DTO de detalhe (`CollectionDetailDTO`) era unico em `collection-lifecycle` e o hub/oficina inferiam o shape via `ReturnType<typeof getCollectionDetail>`.

A Fase H e a extracao documentada: `entities/collection` com `model` + `index.ts`, sem repository. Pedido explicito do humano em 2026-09-13.

Hub e oficina ainda chamam `getCollectionDetail` / `getCollectionEvents` no DAL de `collection-lifecycle` (dois arquivos). Isso e query, nao modelo. Mover essas funcoes para a entidade seria generic repository — proibido pelo [ADR 0009](./0009-data-access-layer.md).

## Decisao

**A unica slice `entities/` vigente e `entities/collection`.**

- Conteudo: `model/status.ts` (status, filtros, labels, helpers) e `model/collection.ts` (`CollectionDetailDTO`). API publica: `src/entities/collection/index.ts` (cliente-safe; sem `index.server.ts`).
- Consumidores (`_pages`, `_app`, `app/`) importam so `@/entities/collection`.
- Schemas Zod de parse RPC permanecem no DAL da slice (`collection-lifecycle/model/contracts.ts`). O enum de status e o filtro da listagem **derivam** dos tuples da entidade (`z.enum(collectionStatuses)` / `z.enum(collectionsListFilters)`).
- Leituras e mutacoes continuam em `_pages/<slice>/api/queries.ts` e `commands.ts` (ADR 0009). `getCollectionDetail` permanece em `collection-lifecycle` com `cache()`.

## Proibido

- Queries, commands, cliente Supabase ou pasta `repository` / `dal/` dentro de `entities/`.
- Nova slice `entities/`, `features/` ou `widgets/` sem reuso real **e** ADR.
- Voltar a colocar status/filtro/label de coleta em `shared/model`.
- `shared/` importar `entities/` (camada de baixo nao importa a de cima).
- Sidestep da API publica (`@/entities/collection/model/**`).

## Excecao FSD aceita

`collection-operations` pode importar o DAL de `collection-lifecycle` **somente** em:

- `src/_pages/collection-operations/api/load-operation.ts`
- `src/_pages/collection-operations/ui/collection-detail-hub-route.tsx`

Steiger `fsd/forbidden-imports` permanece off nesses dois arquivos. Nao e lacuna da Fase H: e composicao hub/oficina sobre o DAL de detalhe, sem repository na entidade.

## Consequencias

- Dominio de status e DTO de detalhe tem um dono abaixo das pages.
- A ponte `shared/model/collection-status.ts` deixa de existir.
- Fases A–H do plano de arquitetura estao **feitas**. [`architecture-improvement.md`](../design-patterns/architecture-improvement.md) esta **closed** (2026-09-13). Melhoria arquitetural ulterior so com pedido explicito. Sem Fase I.

## Fontes

- [`architecture-improvement.md`](../design-patterns/architecture-improvement.md) § Fase H
- [`fsd.md`](../architecture/fsd.md)
- [ADR 0009](./0009-data-access-layer.md)
- Feature-Sliced Design v2.1 — extract when needed
