# Protótipo Figma — frames no app

| Campo | Valor |
| :--- | :--- |
| **Arquivo** | [Sistema de Coleta MJT — Design System e Fluxos](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ) (`akpo5W8c3ViA1hvjeqg9YJ`) |
| **Canvas** | [15 — Protótipo navegável](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=23-107) (`23:107`) |
| **Total no canvas** | 56 frames |
| **No app** | 23 (M01, M06, Q01–Q06, CFG01, M11, M12, S02, S03, S05, S11, NF01, A03, ENV01, M09, M18, SH01, SH02, PDF01, PDF02) |
| **Last verified** | 2026-09-13 |
| **Authority** | `informative` — inventário visual; não altera DAL, PWA nem performance |

Fonte única para saber **quais frames da página 15 já estão no código**. Cada lote novo acrescenta linhas em **Implementados**; não reabrir o Figma só para contar.

Não misturar este inventário com [performance.md](../design-patterns/performance.md) (Fases 1–4 **feitas**; 5–7 planned) nem reabrir [architecture-improvement.md](../design-patterns/architecture-improvement.md) (A–H **closed**). A UX de tap da oficina, do finalize por coleta e do passo do wizard já está no código; o que falta abaixo é alinhamento visual dos frames.

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

---

## Ainda não no app (página 15)

Não implementar wizard/oficina/sync neste eixo de inventário visual. A UX de tap (performance Fase 4) já está no app.

| Id | Nome no Figma | Node | Nota |
| --- | --- | --- | --- |
| M02 | Nova coleta | `229:1094` | Wizard (passo otimista já no código) |
| M02b | Buscar cliente | `229:1709` | Debounce já na Fase 3.2; visual depois |
| M03 | Itens | `229:1140` | Wizard |
| M04 | Revisão | `229:1179` | Wizard |
| M05 | Assinatura | `229:1207` | Finalize (drain desta coleta já no código) |
| M07 | Responsável (não é rota) | `232:87` | Signatário na assinatura |
| M08 | Editar item | `232:110` | Wizard |
| M10 | Documento | `229:1429` | Viewer PDF = performance Fase 6.5 |
| M13 | Aprovação | `229:1503` | Oficina (submit com transition já no código) |
| M13b | Orçamento rejeitado | `229:1879` | Oficina |
| M14 | Serviço | `229:1546` | Oficina |
| M15 | Faturamento | `229:1590` | Oficina |
| M16 | Ciclo do item (timeline no O01) | `229:1629` | Não é rota |
| M17 | Rascunhos | `229:1762` | `/coletas/rascunhos`; header ainda “Coletas” |
| O01 | Detalhe operacional | `229:1235` | Hub; não reescrever reads/`Promise.all` |
| O02 | Entrada na oficina | `229:1266` | Visual; `useWorkshopHubSubmit` já no código |
| O02b | Entrada — não chegou | `281:42` | Visual; submit já no código |
| O03 | Orçamento | `229:1303` | Visual; submit já no código |
| O04 | Entrega ao cliente | `229:1343` | Visual; submit já no código |
| O05 | Cancelar ou reabrir | `229:1377` | Visual; submit já no código |
| O06 | Reabrir coleta | `229:1857` | Visual; submit já no código |
| S01 | Carregamento | `375:5` | `loading.tsx` já na Fase 1 — não reabrir |
| S06 | Salvo localmente | `229:1936` | Copy de finalize já no código |
| S07 | Sincronizando | `229:1942` | Copy de finalize já no código |
| S08 | Falha de sync | `229:1948` | Copy de finalize já no código |
| S09 | Sem permissão | `229:1956` | |
| S10 | Validação | `229:1962` | |
| S12 | Sem espaço | `232:150` | |
| S13 | Sessão expirada | `232:156` | |
| S14 | Sincronizado | `232:162` | Copy de finalize já no código |
| PWA01 | Instalar app | `375:148` | SW intacto (performance §2) |
| PWA02 | Atualizar app | `375:156` | |
| OFF01 | Pendentes offline | `375:164` | Banner Fase 3.1 — não drenar no mount |

---

## Como atualizar

1. Implementar um lote (um eixo; uma família de frames).
2. Acrescentar as linhas em **Implementados** (id, node, rota, ficheiro, uma frase).
3. Remover os ids de **Ainda não no app**.
4. Bater `Last verified`.
