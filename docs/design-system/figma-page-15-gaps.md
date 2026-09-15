# Gaps Figma página 15 × app

| Campo | Valor |
| :--- | :--- |
| **Status** | **informative** — auditoria visual; não altera DAL, PWA, SW nem performance |
| **Data** | 2026-09-14 |
| **Arquivo Figma** | [Sistema de Coleta MJT — Design System e Fluxos](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ) (`akpo5W8c3ViA1hvjeqg9YJ`) |
| **Canvas** | [15 — Protótipo navegável](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=23-107) (`23:107`) |
| **Inventário** | [`figma-prototype-frames.md`](./figma-prototype-frames.md) — 57/57 frames **estão no app** (rota, painel ou copy). Este arquivo lista o que **não bate pixel/copy** com o Figma. |
| **Método** | Árvore XML do canvas + screenshots + código em `src/_pages` / `src/shared`. Rotas de oficina no app: `/coletas/[id]/oficina/{segment}` (o inventário abreviado `/oficina/…`). |

**Veredito:** as 57 frames da página 15 existem no código. **Não batem exatamente** com o Figma. A maior parte da diferença é chrome compartilhado (logo vs Voltar, ícones na bottom nav) e holds já escritos no inventário. O restante é copy, densidade de cards e controles a mais no app.

**Lote visual 2026-09-14 (app):** M06 `itemCount`, CFG01 facts, S09, Q05/Q06 títulos, SH02, M04, M02b, M17 search, O04 chips, token add-item. M06 requer `supabase db push` no remoto.

**Lote polish 2026-09-14 (app):** M01 Sair `md`; `--color-danger` → `#a8443b` (sem hardcodes `#ba5b52`).

Não misturar este arquivo com [`performance.md`](../design-patterns/performance.md) nem reabrir [`architecture-improvement.md`](../design-patterns/architecture-improvement.md). Chrome autenticado (`MobilePageHeader`, `MobileBottomNav`, `PendingNavLink`, `loading.tsx`, banner de pendentes) **não** se reescreve só para alinhar um frame — ver secção 3.

---

## Como ler

| Prioridade | Significado |
| :--- | :--- |
| **P0** | Copy ou estrutura visível que o Figma mostra e o app não (ou o inverso), **sem** hold no inventário. Candidato a correção visual. |
| **P1** | Layout/chrome: Figma mostra uma coisa, o app segue a política de chrome compartilhado. Só mudar com pedido explícito de reescrever o chrome. |
| **Hold** | Inventário já disse que não entra (M07 toggle, M09 Termo/Orçamento/Entrega, M17 Continuar/Descartar, Cidade/UF, S14 como chip). |
| **Figma** | Problema no arquivo Figma (placeholder, frame errado). **Não** copiar para o app. |

---

## 1. Não copiar do Figma

Vários *text layers* de estado (S01, S02, S03, NF01, ENV01, Q05, Q06, PDF01, SH01, S08) ainda se chamam `Não foi possível enviar` no XML. Isso é placeholder reutilizado no canvas. O app já tem corpos honestos (S01 *Aguarde enquanto os dados da coleta são carregados.*; SH01 *O acesso ao PDF é temporário…*). Corrigir o Figma; não o app.

**PWA01/PWA02/OFF01:** títulos e CTAs no código (`pwa-copy.ts`, `offlineCopy`) batem o canvas visível (*Instalar Coleta MJT*, *Nova versão disponível*, *Coletas pendentes neste aparelho*). O XML truncado não é a lei.

**Q04 visível está errado no Figma.** O card visível (`375:85`) copia Q02 (*Guia não encontrada* / *CÓDIGO CONSULTADO* / *Não disponível*). O bloco escondido `result` (`375:71`) tem a copy certa: **Guia não autenticada**. O app implementa a copy escondida + `headerSubtitle` *Guia não autenticada*. Tratar o frame visível como bug de Figma.

---

## 2. Holds já documentados (não “corrigir” sem pedido)

O inventário já declarou estas diferenças de propósito. Continuar fora do escopo de um alinhamento visual.

| Id | Figma mostra | App / inventário |
| --- | --- | --- |
| **M07** | Toggle **Usar outro signatário**; tela própria *Responsável* | Campos só na M05; sem toggle; `responsible-signatory-card.tsx` fora do fluxo |
| **M09** | 4 cards: Guia, Termo de entrada, Orçamento, Termo de entrega | Só **Guia de coleta** + Ver · Baixar. Termo/Orçamento/Entrega ficam nas rotas de oficina |
| **M17** | **Continuar** / **Descartar** em cada card | Sem esses botões na lista; descarte vive em OFF01 |
| **M02** | Só rua + local | Cidade e UF permanecem no **Novo cliente** (sync cadastral) |
| **S14** | Painel cheio *Sincronizado* / *Coleta enviada* | Só chip `SyncStatusChip`; sem hop extra antes do hub |
| **M13** | Sem SignaturePad | Sem pad (scan 5.7) |
| **S01** | Painel isolado 500px | `CaptureStepFallback` no wizard, não `loading.tsx` |
| **M10** | Letterhead estático | Letterhead 342 + iframe só atrás de **Pré-visualizar** |
| **M16** | Tela *Legenda de estados* | Não é rota; rótulo **Linha do tempo** no O01 |

---

## 3. Chrome compartilhado (P1 — política, não bug de frame)

O Figma desenha **quase toda tela autenticada** com:

- Topbar 88px, logo MJT 44×32 à esquerda, **sem** chevron
- Bottom nav 84px, **só texto** (Início · Coletas · Configurações), sem ícone
- CTA 342×52, card 342, marca de estado 92px

O app:

- `MobilePageHeader` tem `min-h-[80px]`; folhas usam `backHref` (chevron) **no lugar** do logo
- `MobileBottomNav` tem ícone + label 11px, pill verde no ativo, `rounded-t-[18px]`
- Coluna do Figma é **342px** (frame 390). O app usa `max-w-md` (~448) com `px-6` → conteúdo ~400px, sem `w-[342px]` em search/cards da lista
- Folhas de oficina (`/coletas/[id]/oficina/*`), wizard, documentos e empresa usam Voltar

O inventário manda **não reescrever** esse chrome ao alinhar um frame. Os gaps abaixo **não** pedem novo header/nav, salvo o humano pedir.

Afetados: M02–M05, M08–M11, M13–M15, M17, M18, O01–O06, O02b.

**Exceção pública:** Q01/Q02/Q04 no Figma têm chevron ‹ no *header revised*. Inventário + app: logo + *Consulta pública*, **sem** Voltar (RSC / QR / WhatsApp). Conflito Figma × inventário — decidir explicitamente.

---

## 4. Gaps P0 — copy e estrutura

### Operador — lista e início

| Id | Figma | App | Status |
| --- | --- | --- | --- |
| **M06** | `{cliente} · {n} itens` | `{cliente} · {n} item(ns)` via `itemCount` no RPC (`20260914180000`) | **Feito** — `db push` no remoto |
| **M01** | Headline; Sair 52×44 | Headline ok; Sair `size="md"` | **Feito** |

### Conta

| Id | Figma | App | Status |
| --- | --- | --- | --- |
| **CFG01** | 6 facts + CTA + Sair | Org/função/e-mail + jurídicos + perfil (links) + CTA + card Sair | **Feito** — sem issuer fetch |
| **M11** | Facts + Sair | Form + banner; sem Sair | Sair omitido de propósito |

### Wizard

| Id | Figma | App | Status |
| --- | --- | --- | --- |
| **M02b** | Cadastral hidden na busca | Cadastral só em Novo cliente | **Feito** |
| **M03** | Só Editar | Editar + Remover | Remover mantido (rascunho) |
| **M04** | Um CTA emitir | Só emitir; Voltar no header | **Feito** |
| **M05** | Labels CPF/CNPJ + pad | Igual | Ok |
| **M08** | Tela cheia; sem Cancelar | Modal + Cancelar | Fora do lote |

### Hub e oficina

| Id | Figma | App | Status |
| --- | --- | --- | --- |
| **O01** | Checklist de ciclo | Log de eventos + budget/CTA matrix | Produto — fora |
| **O01** | *LINHA DO TEMPO* | `uppercase` pinta LINHA DO TEMPO | Ok visual |
| **O02** / **O03** | Densidade Figma | Forms mais densos | Fora |
| **O04** | Pronto / Pronta para retirada | Chip + label; checkbox nativo | **Feito** (✓/□ fora) |
| **M17** | Search hidden | `showSearch={false}` | **Feito** (Continuar/Descartar = hold) |

### Consulta pública / share / estados

| Id | Figma | App | Status |
| --- | --- | --- | --- |
| **Q05** | *Aguarde antes de consultar*; CTA Aguardar | Título curto; sem Aguardar (fake) | **Feito** título |
| **Q06** | *Consulta indisponível* | Igual | **Feito** |
| **SH02** | Fechar | *O link é inválido.* | **Feito** |
| **S09** | *esta ação* | *esta ação* | **Feito** |
| **ENV01** | Entendi | *Entendi* → reload | **Feito** — destino honesto (sem nav fake) |

---

## 5. O que já bate (não reabrir)

- Painéis 342 / CTA 52 / marca 92. Lista sem travar 342.
- `--color-surface-green` no *+ Adicionar item* e índice do card. `--color-danger` / marca erro `#a8443b` (sem `#ba5b52`).
- Chips M06 (8); M02 tabs; M03 Remover; M04 emitir; M06 `{n} itens`; CFG01 facts; O04 Pronto; Q05/Q06/SH02/S09/ENV01 copy do lote; M01 Sair `md`.
- Q01–Q04 títulos oficiais; M10 letterhead corpo (cliente/itens/signatário) + viewer chrome; M13–M15 copy principal.

---

## 6. Checklist dos 57 frames

| Id | Node | Match | Nota curta |
| --- | --- | --- | --- |
| M01 | `229:1060` | ok+ | Sair `md` |
| M02 | `229:1094` | parcial | Cidade/UF hold |
| M02b | `229:1709` | ok+ | Cadastral só em Novo |
| M03 | `229:1140` | parcial | Remover mantido |
| M04 | `229:1179` | ok+ | Sem Voltar duplicado |
| M05 | `229:1207` | ok+ | |
| M06 | `232:38` | ok+ | itemCount (`db push`) |
| M07 | `232:87` | hold | |
| M08 | `232:110` | parcial | |
| M09 | `229:1399` | hold+parcial | |
| M10 | `229:1429` | ok+ | Letterhead: cliente/local/itens/signatário; issuer `{{}}`; sem iframe eager |
| M11 | `229:1462` | parcial | |
| M12 | `232:135` | hold extra | |
| M13 | `229:1503` | parcial | |
| M13b | `229:1879` | parcial | |
| M14 | `229:1546` | ok+ | |
| M15 | `229:1590` | ok+ | |
| M16 | `229:1629` | hold | |
| M17 | `229:1762` | hold | Search hidden; sem Continuar/Descartar |
| M18 | `229:1820` | parcial | |
| O01 | `229:1235` | P0 | Checklist vs log |
| O02 | `229:1266` | parcial | |
| O02b | `281:42` | ok+ | |
| O03 | `229:1303` | parcial | |
| O04 | `229:1343` | ok+ | Pronto / Pronta para retirada |
| O05 | `229:1377` | ok+ | |
| O06 | `229:1857` | ok+ | |
| Q01 | `23:361` | parcial | |
| Q02 | `23:374` | parcial | |
| Q03 | `229:1923` | parcial | |
| Q04 | `375:69` | Figma | |
| Q05 | `375:45` | ok+ | Sem Aguardar fake |
| Q06 | `375:53` | ok+ | |
| S01 | `375:5` | ok+ | |
| S02 | `375:13` | parcial | |
| S03 | `375:21` | ok+ | |
| S05 | `229:1497` | Figma | |
| S06 | `229:1936` | parcial | |
| S07 | `229:1942` | ok | |
| S08 | `229:1948` | ok+ | |
| S09 | `229:1956` | ok | esta ação |
| S10 | `229:1962` | parcial | |
| S11 | `229:1968` | P1/hold | |
| S12 | `232:150` | ok | |
| S13 | `232:156` | ok | |
| S14 | `232:162` | hold | |
| CFG01 | `375:96` | ok+ | Facts + Sair card |
| NF01 | `375:29` | ok | |
| A03 | `275:4` | ok+ | |
| ENV01 | `375:37` | ok+ | Entendi → reload |
| SH01 | `375:132` | ok+ | |
| SH02 | `375:140` | ok+ | Link inválido |
| PDF01 | `375:172` | parcial | |
| PDF02 | `375:61` | parcial | |
| PWA01 | `375:148` | parcial | |
| PWA02 | `375:156` | parcial | |
| OFF01 | `375:164` | hold extra | |

`ok+` = copy principal bate; chrome/placeholder à parte.

---

## 7. Ordem sugerida (restante)

Lote visual 2026-09-14 **feito** no app. Lote polish (M01 Sair + danger token) **feito**. Restante, um eixo por PR:

1. **O01** — checklist do ciclo além do log (só se pedido).
2. **Chrome** — logo vs Voltar, ícones da nav, 88 vs 80.
3. **Densidade / extras** — M08 Cancelar, O02/O03, PWA/PDF/S06 (só se pedido).
4. **Figma** — placeholders de estado; Q04 visível.
