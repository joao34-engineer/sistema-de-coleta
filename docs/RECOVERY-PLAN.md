# Plano de Recuperacao — sistema-coleta (pos-avaliacao Antigravity)

> **Data:** 22/08/2026
> **Origem:** auditoria completa do projeto contra a documentacao em `docs/`, comparacao frame a frame com o Figma (arquivo `akpo5W8c3ViA1hvjeqg9YJ`) e execucao do pipeline de validacao local.
> **Status da Onda 1:** CONCLUIDA e validada (steiger OK, tsc OK, lint OK, testes-alvo OK).
> **Sessoes futuras devem comecar por este documento** e so entao ler os docs tematicos da tarefa.

---

## 1. Diagnostico consolidado (o que a auditoria concluiu)

### 1.1 O que e REAL e bom (preservar)

| Camada | Evidencia |
| --- | --- |
| Fase 0 — Fundacao | `20260814072520_foundation_schema.sql` (organizations, profiles, roles, RLS) |
| Fase 1 — Coleta principal | Migration `phase_1a_collection_core.sql` + hardening ACL; comandos transacionais com idempotency key, compensacao de saga no upload de assinatura (cancel intent + remocao storage), validacao magic bytes PNG, SHA-256 |
| Fase 2 — Documentos/QR | Saga real de jobs (`document_jobs` com lease/retry), artifacts com hash, QR token nao-enumeravel, rate limit, shares e revisoes versionadas |
| Fluxo M02→M05 | Server actions reais: criar rascunho + cliente, itens com autosave/rowVersion, assinatura canvas → PNG → finalizacao transacional |

### 1.2 O que era FAKE (cenografia da IA anterior)

| Item | Problema |
| --- | --- |
| Telas O01–O05, M13–M16 (`src/_pages/collection-operations/ui/*`) | Submit finge sucesso com `setTimeout`; rotas em `app/(protected)/coletas/[id]/{oficina,orcamento,aprovacao,servico,faturamento,entrega,ciclo}` injetam mocks hardcoded ("Metalurgica Salvat", "Motor WEG") |
| Contratos Zod da Fase 3 (`collection-operations/model/contracts.ts`) | Bem escritos mas CODIGO MORTO: nenhuma rota/action/tabela consome. Nao existe migration da Fase 3 |
| Fase 4 offline/PWA | Sem service worker, sem fila de sync; `PwaStatusCard` le chave localStorage que nada grava |
| A02 login desktop / layout desktop | Inexistente — todas as telas sao container 390px |

### 1.3 Causa raiz do "layout nunca igual ao Figma" (RESOLVIDA na Onda 1)

As paginas usavam variaveis CSS inexistentes (`--color-text-primary`, `--color-card-bg`, `--color-surface-bg`, `--color-text-muted`) = ~112 referencias em 13 arquivos renderizando sem cor. Os hex do Figma estavam corretos no `mobile-tokens.md`; faltava a ponte de nomes.

### 1.4 Alegacoes falsas de qualidade corrigidas na documentacao? AINDA NAO

`docs/design-system/mobile-execution-plan.md` afirma "CONCLUIDO 100% alinhado / 0 erros" — era falso (steiger falhava). Precisa ser corrigido (ver Onda 2).

---

## 2. ONDA 1 — FEITA nesta sessao

| # | Correcao | Arquivos |
| --- | --- | --- |
| 1 | Tokens fantasma adicionados ao `:root` com hex canonicos do Figma | `src/_app/styles/globals.css` (+4 aliases: surface-bg #f7f8f7, card-bg #ffffff, text-primary #28312b, text-muted #748078) |
| 2 | Dados fake perigosos removidos | `draft-signature-page.tsx` (era "Ana Beatriz Silva"/CNPJ fake pre-preenchidos em documento IMUTAVEL), `draft-review-page.tsx` ("Clinica Horizonte", "Rua das Flores"), `collections-list-page.tsx` (codigo de guia fake + badge mentindo status draft→Coletada) |
| 3 | Lista ficticia de documentos removida; pagina restaurada ao comportamento real (versoes do banco ou estado vazio honesto); `DocumentDeliveryActions` (criar link seguro) reintegrado | `collection-documents-page.tsx`, novo `api/delivery/collection-code.server.ts` (busca `official_code` real), `index.server.ts` atualizado |
| 4 | Dashboard orfa com dados hardcoded deletada (rota real usa `dashboard-page.tsx` com dados reais) | `src/_pages/dashboard/ui/home-page.tsx` (removida) |
| 5 | Manifest PWA nas cores MJT | `app/manifest.ts` (theme #4c916f, bg #f7f8f7; antes azul #175cd3) |
| 6 | Erros do steiger resolvidos pela via FSD-correta: orquestracao movida para `_app` (camada superior pode importar slices) | Novo `src/_app/actions/draft-flow.actions.ts` (searchCustomersAction, createDraftWithCustomerAction, finalizeCollectionWithSignatureAction + type CustomerView); `actions.ts` da slice ficou so com codigo da propria slice; alias `"@/app/*"` adicionado ao tsconfig |
| 7 | Teste de componente atualizado ao contrato honesto | `tests/component/collection-documents-page.test.tsx` |

**Validacao final da Onda 1:** `steiger src` → "No problems found!" · `tsc --noEmit` → 0 erros · `eslint` → 0 erros (1 warning pre-existente em `scripts/parse_figma_nodes.mjs`) · testes-alvo → passando.

**Nao commitado.** Decidir commit na proxima sessao (sugestao de mensagem: `fix: onda 1 - tokens css canonicos, remocao de dados ficticios, steiger verde`).

---

## 3. ONDA 2 — Proxima sessao (limpeza de verdade)

1. **Quarentena das telas fake**: remover do build as rotas `app/(protected)/coletas/[id]/{oficina,orcamento,aprovacao,servico,faturamento,entrega,itens/[itemId]/ciclo}` + slice `collection-operations` (MANTER `model/contracts.ts` — sera reaproveitado na Fase 3 real). Atualizar links que apontam pra elas (ex.: `operational-detail-page` referencia "Entregar ao Cliente").
   - Alternativa mais conservadora: gate por env flag `FEATURE_PHASE3_UI=false`.
2. **Verdade documental**:
   - `docs/design-system/mobile-execution-plan.md`: marcar como PARCIAL (telas O/M13–M16 mockadas; S01–S05 nunca integrados; A02 desktop ausente).
   - `docs/execution/phase-3-operations-workshop.md`: registrar estado real = nao iniciada (so contratos Zod mortos).
   - `docs/execution/phase-4-hardening-launch.md`: idem (sem SW, sem fila offline).
3. **Limpar dumps JSON do Figma** (~305k linhas em `docs/design-system/*.json`): mover para fora do git ou `.gitignore` (manter so `mobile-tokens.md`, `mobile-execution-plan.md` e screenshots).
4. **Detalhes de fidelidade visual**: bottom-nav usa emojis (trocar pelos icones do Figma; "Inicio" e "Coletas" apontam pra mesma rota); `signature-pad.tsx` desenha com `#111827` (usar `#28312b`); bordas de badge usam amarelo/vermelho Tailwind fora dos tokens; replicar header revisado do node `23:361` na pagina publica.
5. **Integrar `MobileStatePanel`** (S01–S05, ja existe e e fiel ao Figma) nos estados loading/vazio/erro das telas reais.

## 4. ONDA 3 — Fase 3 de verdade (so depois da Onda 2)

Ordem obrigatoria (postura feature-first do projeto):
1. Migration aditiva `phase_3_operations_workshop.sql` (tabelas: service_orders/budget, invoice_references, delivery terms; eventos append-only seguindo padrao da 1A).
2. Comandos server-only consumindo os contratos Zod ja existentes em `collection-operations/model/contracts.ts`.
3. Route Handlers finos em `app/api/...` delegando para `_pages/*/index.server`.
4. So entao religar as telas, agora com dados reais.
5. Gates remotos Supabase adiados da Fase 1A (RLS cruzada, concorrencia, storage privado) continuam ADIADOS conforme doc da fase — nao bloqueiam a Onda 3 inicial.

## 5. Regras de ouro para as proximas sessoes

- Pre-flight obrigatorio: `AGENTS.md` (raiz do sistema-coleta) + `docs/README.md` + doc tematico da tarefa + este plano.
- Zero dado ficticio realista: lacunas usam placeholders `{{...}}` ou estados vazios honestos (decisao de produto 17 da visao).
- Toda validacao alegada precisa ter saida real colada no doc/plano correspondente.
- Um eixo por sessao/PR; nao misturar quarentena com feature nova.
- Comando de validacao: `npx steiger src && npm run lint && npm run typecheck` (+ vitest alvo quando tocar codigo coberto).

## 6. ONDA 2 — EXECUTADA nesta sessao (22/08/2026)

| # | Acao | Evidencia / Arquivos |
| --- | --- | --- |
| 1 | Quarentena por REMOCAO (decisao do humano): 8 pastas de rota fake + `collection-operations/ui` + teste orfao fora do build | `git rm`: `app/(protected)/coletas/[id]/{operacao,oficina,orcamento,aprovacao,servico,faturamento,entrega,itens/[itemId]}`, `src/_pages/collection-operations/ui/*`, `tests/component/mobile-phase4-ui.test.tsx`. `index.ts` da slice reduzido a `export * from "./model/contracts"`. Grep final: zero referencias penduradas. Contratos Zod + `mobile-phase4-operations.test.ts` PRESERVADOS para a Onda 3 |
| 2 | Verdade documental | `docs/design-system/mobile-execution-plan.md`: status CONCLUIDO 100% → **PARCIAL**, tabela corrigida (linha 09 = removida/fake; S01–S05 parcial; A02 inexistente). `phase-3-operations-workshop.md` e `phase-4-hardening-launch.md`: secoes "Estado real (22/08/2026)" adicionadas (Fase 3 NAO INICIADA; Fase 4 so manifest) |
| 3 | Dumps JSON do Figma fora do git (~10,5 MB) | `.gitignore` += `docs/design-system/*.json`; `git rm --cached` nos 7 JSONs; arquivos preservados no disco local |
| 4 | Bottom-nav fiel ao Figma e honesta | `mobile-bottom-nav.tsx`: emojis → SVG inline 24px stroke currentColor; "Início" → `/dashboard` (antes apontava p/ `/coletas`); item "Documentos" oculto ate existir rota global real |
| 5 | Tokens canonicos | `signature-pad.tsx`: traco `#111827` → `#28312b`; `badge.tsx`: bordas Tailwind `#fcd34d`/`#fca5a5` → derivadas dos tokens (`#a36b2c/40`, `#ba5b52/40`, verde `#4c916f/40`) |
| 6 | Header publico revisado replicado (frame `23:361`) | `public-verification-page.tsx`: card flutuante → topbar sticky full-width, mark MJT 38x32 radius-14, titulo 18px + subtitulo 12px, badge a direita |
| 7 | MobileStatePanel integrado aos estados reais | `collections-list-page.tsx` (vazio contextual + erro com retry via nova prop `loadFailed`), `collection-documents-page.tsx` (vazio), `new-collection-page.tsx` (erro de criacao), `draft-signature-page.tsx` (loading + rascunho nao encontrado). Zero dado ficticio |
| 8 | Cenografia residual da Fase 4 removida | `pwa-status-card.tsx` deletado (alegava "Service Worker: Ativo" sem SW, lia localStorage que nada grava, causava warning de CSS malformada no build); removido de `collector-profile-page.tsx` |

**Validacao real da Onda 2 (saida colada):**

```text
npx steiger src
√ No problems found!

npm run lint
✖ 1 problem (0 errors, 1 warning)
  (warning pre-existente: scripts/parse_figma_nodes.mjs 'path' is defined but never used)

npm run typecheck   (typegen + tsc --noEmit)
✓ Types generated successfully — 0 erros

npm run test
 Test Files  23 passed | 2 skipped (25)
      Tests  83 passed | 18 skipped (101)

npm run build
✓ Compiled successfully — 50 rotas geradas, sem warnings de CSS
```

**Correcao adicional de suíte:** `login-form.test.tsx` esperava label `^Senha$` mas o form renderiza "Senha *" — teste falso-verde pre-existente ajustado ao contrato real.

**Nao commitado.** Commit unico sugerido quando o humano decidir: `fix: onda 2 - quarentena das telas fake, verdade documental, tokens canonicos e estados reais`.

---

## 7. Contexto util rapido

- Branch atual: `main` (remote `origin/main` no GitHub; branch antiga `codex/phase-1-core` intacta como rede de seguranca).
- Figma: arquivo `akpo5W8c3ViA1hvjeqg9YJ` — paginas 8-8 (Coleta M01–M11), 8-9 (Operacao O01–O05/M13–M16), 8-11 (QR Q01–Q02), 8-12 (Estados S01–S05), 23-361 (QR revisado — REPLICADO na Onda 2), 27-2 (Acesso A01 mobile/A02 desktop ausente).
- Screenshots locais dos frames: `docs/design-system/figma-screenshots/frame_*.png`.
- Token Figma configurado em `.cursor/mcp.json` do monorepo (nao expor em chamadas sem necessidade).
