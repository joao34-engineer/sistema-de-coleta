# Arquitetura FSD com Next.js

## Decisao

Usar Feature-Sliced Design (FSD) v2.1 de forma progressiva. A versao inicial tera apenas `src/_app`, `src/_pages` e `src/shared`. Camadas adicionais existem para resolver reuso real, nao como pastas vazias de planejamento.

O App Router ocupa `app/`; por isso as camadas FSD equivalentes sao nomeadas `_app` e `_pages`, como recomenda a integracao oficial do FSD para Next.js.

## Estrutura inicial

```text
app/                              # convencoes do Next: rotas e metadata
  layout.tsx
  page.tsx                        # reexporta HomePage
  (app)/coletas/nova/page.tsx     # reexporta NewCollectionPage
  api/collections/finalize/route.ts
src/
  _app/
    providers/
    styles/
    api-routes/
  _pages/
    collections/new/
      ui/
      model/
      api/
      index.ts
  shared/
    api/
    auth/
    config/
    db/
    lib/
    ui/
```

Arquivos em `app/` so compoem/reexportam uma pagina ou delegam um handler. Cada slice de `_pages` possui `index.ts` como API publica. Segmentos podem ser omitidos quando nao houver codigo para eles.

## Regras de dependencia

```text
_app -> _pages -> widgets -> features -> entities -> shared
```

- Uma camada importa apenas camadas abaixo dela.
- Slices da mesma camada nao se importam diretamente.
- Consumidores externos usam apenas o `index.ts` da slice; nao acessam arquivos internos.
- `shared` nao recebe regra de negocio de coleta, cliente, guia ou oficina.
- Arquivos de dominio usam nomes de dominio: `model/collection.ts`, `api/finalize-collection.ts`; nunca arquivos acumuladores como `types.ts`, `utils.ts` ou `helpers.ts`.

## Quando extrair

| Situacao atual | Local correto |
| --- | --- |
| Formulario Nova Coleta usado somente nessa rota | `_pages/collections/new/` |
| Barra de navegacao usada em duas ou mais paginas | `widgets/navigation/` |
| Acao de finalizar coleta usada em dois fluxos | `features/finalize-collection/` |
| Modelo de coleta consumido por paginas e features distintas | `entities/collection/` |
| Cliente Supabase, guard de erro, formatador de data | `shared/` |

Antes de extrair, verificar se as duas ocorrencias mudam sempre juntas. Se sim, manter local ou mesclar. Nao usar `@x` sem ADR: primeiro mesclar fronteiras, mover logica para entidade ou compor por uma camada superior.

## Fronteiras Next.js

- `src/shared/db` e `index.server.ts` importam `server-only` e nunca sao exportados por um `index.ts` consumivel no cliente.
- `index.ts` da slice nao pode levar codigo server-only ao grafo do cliente. Criar `index.server.ts` somente quando essa separacao for necessaria.
- A diretiva `'use client'` fica no componente folha interativo, nunca no topo de uma pagina por comodidade.
- Server Components buscam dados e entregam DTOs serializaveis. Client Components nao recebem clients Supabase, segredos, `Error`, `Map`, `Set` ou funcoes.

## Validacao arquitetural

Configurar aliases para todas as camadas em `tsconfig.json` e usar o linter oficial Steiger quando o codigo existir. Violacao de direcao de importacao deve falhar no lint/CI.

Fontes: [FSD overview](https://fsd.how/docs/get-started/overview/) e [uso com Next.js](https://fsd.how/uz/docs/guides/tech/with-nextjs/).
