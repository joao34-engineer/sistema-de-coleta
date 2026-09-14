# Protótipo Figma — frames no app

| Campo | Valor |
| :--- | :--- |
| **Arquivo** | [Sistema de Coleta MJT — Design System e Fluxos](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ) (`akpo5W8c3ViA1hvjeqg9YJ`) |
| **Canvas** | [15 — Protótipo navegável](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=23-107) (`23:107`) |
| **Total no canvas** | 57 frames |
| **No app** | 57 (M01, M02, M02b, M03, M04, M05, M06, M07, M08, M09, M10, M11, M12, M13, M13b, M14, M15, M16, M17, M18, Q01–Q06, CFG01, S01, S02, S03, S05, S06–S14, NF01, A03, ENV01, SH01, SH02, PDF01, PDF02, O01, O02, O02b, O03, O04, O05, O06, PWA01, PWA02, OFF01) |
| **Last verified** | 2026-09-14 |
| **Authority** | `informative` — inventário visual; não altera DAL, PWA nem performance |

Fonte única para saber **quais frames da página 15 já estão no código**. Cada lote novo acrescenta linhas em **Implementados**; não reabrir o Figma só para contar.

Não misturar este inventário com [performance.md](../design-patterns/performance.md) (Fases 1–7 **feitas**) nem reabrir [architecture-improvement.md](../design-patterns/architecture-improvement.md) (A–H **closed**). A UX de tap da oficina, do finalize por coleta e do passo do wizard já está no código. Página 15 está no app: **S01** é o painel in-page (`CaptureStepFallback`), não `loading.tsx`; **M10** é o letterhead estático, não o iframe da Fase 6.5.

Chrome compartilhado do app autenticado (`MobilePageHeader`, bottom nav, `PendingNavLink`, `loading.tsx`, `cache()` de auth, banner de pendentes) **não** se reescreve ao alinhar um frame.

---

## Implementados

### Lote 2026-09-07 — operador (Início + lista)

| Id | Figma | Node | Rota | Código | O que entrou |
| --- | --- | --- | --- | --- | --- |
| **M01** | [Início](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=229-1060) | `229:1060` | `/dashboard` | `src/_pages/dashboard/ui/dashboard-page.tsx` | Logo PNG da login, headline da rota, CTA Nova coleta (`PendingNavLink`), atividades. Sem Ver rascunhos. |
| **M06** | [Lista de coletas](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=232-38) | `232:38` | `/coletas` | `src/_pages/collection-lifecycle/ui/collections-list-page.tsx` | Mesmo logo PNG, 8 chips, `pendingFilter` + prefetch da Fase 1.5. Sem filtrar cards locais. |

### Lote 2026-09-13 — consulta pública (Q01–Q06) — **feito**

Rota `/verificar/[verificationToken]`. Coluna `max-w-md` centrada (igual `/configuracoes/empresa`). Página **RSC pura** (QR / WhatsApp / browser — o chrome do aparelho já tem Voltar).

- **Header:** logo + “Consulta pública”. Sem chevron, sem `PendingNavLink` e sem `/dashboard`.
- **Card:** ícone, título, código e status centrados. HTML público mostra **só código + status** (organização, emissão e versão ficam no DTO/API).
- **Logo:** `/logo/Logo_-_MJT-removebg-preview.png` (`next/image`).

| Id | Figma | Node | Estado no app | Código | O que entrou |
| --- | --- | --- | --- | --- | --- |
| **Q01** | [Guia verificada](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=23-361) | `23:361` | `authentic` e não cancelada | `public-verification-page.tsx` | Título **Guia verificada**; código + `collectionStatusLabel`. |
| **Q02** | [Código inválido](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=23-374) | `23:374` | `verification === null` | idem | **Guia não encontrada**; código `—`; status Não disponível. |
| **Q03** | [Guia cancelada](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=229-1923) | `229:1923` | `status === canceled` | idem | Permanece verificável; código + Cancelada. |
| **Q04** | [Guia não autenticada](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=375-69) | `375:69` | `authentic === false` e não cancelada | idem | Sem PII extra; código oficial se o DTO existir. |
| **Q05** | [Aguarde consultar](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=375-45) | `375:45` | rate limit | `public-verification-wait-page.tsx` | Mesmo chrome; segundos de retry no corpo; sem timer client. |
| **Q06** | [Consulta indisponível](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=375-53) | `375:53` | limiter falhou fechado | idem | Sem vazar token. |

Ficheiros: `public-verification-chrome.tsx`, `public-verification-page.tsx`, `public-verification-wait-page.tsx`.

### Lote 2026-09-13 — conta, login e estados (CFG01, M11, M12, S02, S03, S05, S11, NF01, A03, ENV01) — **feito**

Visual only. Sem query nova no tab `/configuracoes`. Sem rewrite de `MobilePageHeader`, bottom nav, `PendingNavLink`, `loading.tsx`, `cache()`, banner de pendentes, SW ou DAL. Folha `/configuracoes/empresa` mantém Voltar (`backHref`). Primary continua `--color-primary`.

| Id | Figma | Node | Rota | Código | O que entrou |
| --- | --- | --- | --- | --- | --- |
| **CFG01** | [Conta do operador](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=375-96) | `375:96` | `/configuracoes` | `collector-profile-page.tsx` | Título **Conta**; fatos org/função/e-mail; CTA institucional; `SignOutForm`. Logo PNG. Sem fetch de issuer. |
| **M11** | [Configurações](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=229-1462) | `229:1462` | `/configuracoes/empresa` | `company-settings-page.tsx` | Título **Empresa**; campos de emissão intactos; CTA **Salvar configurações**. |
| **M12** | [Login](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=232-135) | `232:135` | `/login` | `login-page.tsx` | **Acessar** / Entre para continuar / **Entrar**. Dica iOS e rodapé MJT mantidos. |
| **S02** | [Vazio](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=375-13) | `375:13` | painéis empty | `mobile-state-panel.tsx` | Card 342 / marca 92px. Call sites inalterados. |
| **S03** | [Erro seguro](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=375-21) | `375:21` | `app/error.tsx` | `route-error-fallback.tsx` | Mesmo painel; digest; retry. Sem PII. |
| **S05** | [Confirmação](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=229-1497) | `229:1497` | dialog | `confirm-dialog.tsx` | Marca 92px; botões empilhados. |
| **S11** | [Confirmar descarte](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=229-1968) | `229:1968` | banner offline | idem + `offline-pending-banner.tsx` | Mesmo dialog; discard/drain intactos. |
| **NF01** | [Página não encontrada](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=375-29) | `375:29` | `app/not-found.tsx` | `not-found.tsx` | **Voltar ao início** → `/`. |
| **A03** | [Acesso não autorizado](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=275-4) | `275:4` | layout protegido | `access-denied-page.tsx` | Painel + `SignOutForm`. Não é S09. |
| **ENV01** | [Ambiente não configurado](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=375-37) | `375:37` | `/` | `app/page.tsx` | Fail-closed `hasPublicEnvironment()`; sem auth extra. |

### Lote 2026-09-13 — documentos, share e PDF status (M09, M18, SH01, SH02, PDF01, PDF02) — **feito**

Visual only. Sem query nova, sem `inspectDocumentShare` no HTML de `/d/[shareToken]`, sem iframe/M10 (Fase 6.5), sem cards de oficina, sem rota nova de compartilhar. Poll/retry de PDF e POSTs de share/e-mail intactos. `loading.tsx` de documentos e `Promise.all` da lista intactos.

| Id | Figma | Node | Rota | Código | O que entrou |
| --- | --- | --- | --- | --- | --- |
| **M09** | [Documentos](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=229-1399) | `229:1399` | `/coletas/[id]/documentos` | `collection-documents-page.tsx` | Título **Documentos**; card **Guia de coleta** 342px; Ver · Baixar. Sem Termo/Orçamento/Entrega. |
| **M18** | [Compartilhar guia](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=229-1820) | `229:1820` | idem (painel) | `document-delivery-actions.tsx` | Destinatário, Enviar e-mail, criar link/WhatsApp. Sem rota extra. |
| **SH01** | [Link seguro](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=375-132) | `375:132` | `/d/[shareToken]` | `document-share-page.tsx` | Painel **Documento protegido**; Baixar PDF → `/download`. Sem inspect. |
| **SH02** | [Link indisponível](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=375-140) | `375:140` | idem (hex inválido) | idem | Só shape inválido; Fechar → `/`. Expirado/revogado continua no download. |
| **PDF01** | [PDF gerando](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=375-172) | `375:172` | lista/viewer | `pdf-pending-status.tsx` | `MobileStatePanel` loading; poll 3s / 20; Aguarde. |
| **PDF02** | [PDF falhou](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=375-61) | `375:61` | idem | idem | Painel erro + Tentar de novo (POST retry). |

### Lote 2026-09-14 — hub, rascunhos e oficina (M17, O01, O02, O02b, O03–O06, M14, M15) — **feito**

Visual only. Sem query nova, sem rewrite de `Promise.all` do hub, `useWorkshopHubSubmit`, SignaturePad, SW, `loading.tsx` ou DAL. Lista `/coletas` (M06) continua **Coletas** + chips. M13/M13b ficam de fora (scan 5.7). M16 não é rota — o rótulo **Linha do tempo** entrou no O01.

| Id | Figma | Node | Rota | Código | O que entrou |
| --- | --- | --- | --- | --- | --- |
| **M17** | [Rascunhos](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=229-1762) | `229:1762` | `/coletas/rascunhos` | `collections-list-page.tsx` | Título **Rascunhos** / **Salvos neste aparelho**. Sem Continuar/Descartar (OFF01). Chips da M06 intactos. |
| **O01** | [Detalhe operacional](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=229-1235) | `229:1235` | `/coletas/[id]` | `collection-detail-hub.tsx` | **Guia {código}**; `{n} itens · status`; cliente 24px; **Linha do tempo**; CTA `PendingNavLink` no rodapé. Reads/`Promise.all` intactos. |
| **O02** | [Entrada na oficina](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=229-1266) | `229:1266` | `/oficina/checkin` | `workshop-checkin-page.tsx` | Contador `{n} itens`; cards e **Confirmar entrada**. Submit/hook/pad intactos. |
| **O02b** | [Entrada — não chegou](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=281-42) | `281:42` | idem (segmento) | `arrival-segment.tsx` | Mesma página; `{n} itens · {k} não chegou`. |
| **O03** | [Orçamento](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=229-1303) | `229:1303` | `/oficina/orcamento` | `technical-budget-page.tsx` | Header **Orçamento técnico**; **Por item**; CTA **Salvar orçamento**. |
| **O04** | [Entrega ao cliente](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=229-1343) | `229:1343` | `/oficina/entrega` | `customer-delivery-page.tsx` | **Selecione os itens para entrega**; CTA 52px. Pad intacto. |
| **O05** | [Cancelar ou reabrir](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=229-1377) | `229:1377` | `/oficina/cancelar` | `cancel-reopen-page.tsx` | **Histórico preservado**; intro da guia. Sem fundir com O06. |
| **O06** | [Reabrir coleta](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=229-1857) | `229:1857` | `/oficina/reabrir` | idem | **Mesmo número oficial**; intro da reabertura. |
| **M14** | [Serviço](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=229-1546) | `229:1546` | `/oficina/progresso` | `service-progress-page.tsx` | Headline **Itens prontos n de m**. Header continua **Progresso do reparo**. |
| **M15** | [Faturamento](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=229-1590) | `229:1590` | `/oficina/nfe` | `invoice-reference-page.tsx` | **Referência manual**. Header continua **Registro de NF-e**. |

### Lote 2026-09-14 — wizard visual (M02–M08) — **feito**

Visual only. Sem mudar `setStep`/`replace`, debounce 300 ms, drain, `dynamic()` dos passos ou `ssr: false` do pad. Cidade/UF do cadastro permanecem (sync cadastral). M07 não é rota — campos de signatário na M05. `responsible-signatory-card.tsx` continua fora do fluxo.

| Id | Figma | Node | Rota | Código | O que entrou |
| --- | --- | --- | --- | --- | --- |
| **M02** | [Nova coleta](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=229-1094) | `229:1094` | `/coletas/nova` | `new-collection-page.tsx` | Headline **Dados do cliente**; tabs Novo/Buscar; campos 342; CTA **Continuar**; barras + chip. |
| **M02b** | [Buscar cliente](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=229-1709) | `229:1709` | idem (aba) | idem | Placeholder da busca; card selecionado; hint offline. Debounce intacto. |
| **M03** | [Itens](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=229-1140) | `229:1140` | `/coletas/[id]/itens` | `capture-items-step.tsx` | Cards 342; índice; **Editar**; **+ Adicionar item**; **Revisar coleta**. |
| **M04** | [Revisão](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=229-1179) | `229:1179` | `/coletas/[id]/revisao` | `draft-review-page.tsx` | Cards cliente/itens/local; CTA **Emitir guia e coletar assinatura**. Input de local intacto. |
| **M05** | [Assinatura](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=229-1207) | `229:1207` | `/coletas/[id]/assinatura` | `capture-signature-step.tsx` | **Assinatura do signatário**; pad; **Nome / CPF de quem assinou**; **Finalizar coleta**. |
| **M07** | [Responsável](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=232-87) | `232:87` | idem (campos) | idem | Não é rota. Sem toggle “Usar outro signatário”. |
| **M08** | [Editar item](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=232-110) | `232:110` | modal | `edit-item-modal.tsx` | **Editar item** / **Adicionar item**; **Salvar item**; 342 sheet. Sem rota nova. |

### Lote 2026-09-14 — estados, PWA e aprovação (M13, M13b, M16, S06–S14, PWA01, PWA02, OFF01) — **feito**

Visual only. Sem SignaturePad na aprovação (scan 5.7). Sem SW / `public/sw.js`. Sem drain no mount do banner. Sem tela bloqueante S14 antes do hub. Sem substituir A03. M16 não é rota — rótulo **Linha do tempo** já no O01.

| Id | Figma | Node | Rota | Código | O que entrou |
| --- | --- | --- | --- | --- | --- |
| **M13** | [Aprovação](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=229-1503) | `229:1503` | `/oficina/aprovacao` | `budget-approval-page.tsx` | Card **TOTAL DO ORÇAMENTO**; campos empilhados; CTAs 52px. `useWorkshopHubSubmit` intacto. Sem pad. |
| **M13b** | [Orçamento rejeitado](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=229-1879) | `229:1879` | hub (`rejected`) | `collection-detail-hub.tsx` | Copy **Orçamento rejeitado**. CTA **Novo orçamento** intacto. Não é rota. |
| **M16** | [Ciclo do item](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=229-1629) | `229:1629` | hub (timeline) | `collection-detail-hub.tsx` | Inventário: rótulo **Linha do tempo** já no O01. Não é rota. |
| **S06** | [Salvo localmente](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=229-1936) | `229:1936` | captura `queuedDone` | `collection-capture-page.tsx` | `MobileStatePanel` **Salvo neste aparelho** + corpo. |
| **S07** | [Sincronizando](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=229-1942) | `229:1942` | assinatura `isFinalizing` | `capture-signature-step.tsx` | Painel **Sincronizando** só no drain desta coleta. Chip do wizard intacto. |
| **S08** | [Falha de sync](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=229-1948) | `229:1948` | captura `onlineFinalizeError` | `collection-capture-page.tsx` | Título via `titleForOperatorError`; **Tentar de novo**. |
| **S09** | [Sem permissão](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=229-1956) | `229:1956` | painel de erro | `offline-copy.ts` | `forbidden` → **Sem permissão**. Não substitui A03. |
| **S10** | [Validação](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=229-1962) | `229:1962` | idem | idem | Validação/CPF → **Validação**. |
| **S12** | [Sem espaço](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=232-150) | `232:150` | idem | idem | Quota → **Sem espaço**. |
| **S13** | [Sessão expirada](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=232-156) | `232:156` | idem | idem | `authExpired` → **Sessão expirada**. |
| **S14** | [Sincronizado](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=232-162) | `232:162` | chip | `sync-status-chip.tsx` | Copy **Sincronizado**. Sem hop extra antes do hub. |
| **PWA01** | [Instalar app](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=375-148) | `375:148` | banner | `install-prompt.tsx` | `MobileStatePanel` 342 / 92px. `beforeinstallprompt` / iOS intactos. SW intacto. |
| **PWA02** | [Atualizar app](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=375-156) | `375:156` | banner | `pwa-update-banner.tsx` | Mesmo painel. SW intacto. |
| **OFF01** | [Pendentes offline](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=375-164) | `375:164` | banner | `offline-pending-panel.tsx` | **Coletas pendentes neste aparelho**; marca 92px. Lista + Continuar / Descartar / Retry. Sem drain no mount. |

### Lote 2026-09-14 — holds S01 + M10 — **feito**

Visual only. Sem reabrir `loading.tsx` / `ProtectedRouteSkeleton`. Sem `getCollectionDetail`, sem issuer fetch, sem iframe no mount. `LazyPdfPreview` continua atrás de **Pré-visualizar**.

| Id | Figma | Node | Rota | Código | O que entrou |
| --- | --- | --- | --- | --- | --- |
| **S01** | [Carregamento](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=375-5) | `375:5` | wizard hydrate | `capture-step-fallback.tsx` | `MobileStatePanel` **Carregando a coleta** + **Aguarde**. Não é `loading.tsx`. |
| **M10** | [Documento](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=229-1429) | `229:1429` | `/coletas/[id]/documentos/[docId]` | `document-viewer-page.tsx` | Header **Guia de coleta** / **Visualização**; letterhead 342; Baixar PDF + Compartilhar (M18). Sem iframe eager. |

---

## Ainda não no app (página 15)

Nenhum. Desktop página 12 fica fora deste inventário.

---

## Como atualizar

1. Implementar um lote (um eixo; uma família de frames).
2. Acrescentar as linhas em **Implementados** (id, node, rota, ficheiro, uma frase).
3. Remover os ids de **Ainda não no app**.
4. Bater `Last verified`.
