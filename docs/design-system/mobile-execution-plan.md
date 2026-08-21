# Plano de Execução & Rastreabilidade Mobile (Figma → Next.js FSD)

Este documento é a **fonte única de rastreabilidade de execução** para o desenvolvimento da interface Mobile do *Sistema de Coleta MJT*, baseado no arquivo oficial do Figma (`akpo5W8c3ViA1hvjeqg9YJ`).

---

## 📌 Status Geral do Projeto

- **Sessão de Origem**: `86199939-3149-4ff1-bb8f-d4be3110da92`
- **Repositório**: `https://github.com/joao34-engineer/sistema-de-coleta.git`
- **Validação de Compilação**: 🟢 `npm run typecheck` (0 erros) | 🟢 `npm run lint` (0 erros) | 🟢 61 testes passando
- **Governança**: Zero `any` (cumprimento estrito de `AGENTS.md`), sem arquivos duplicados ou placeholders.

---

## 🗺️ Roadmap de Execução Por Fases

---

### 🟢 FASE 1: Extração de Tokens & Configuração Global CSS (CONCLUÍDO)
- [x] **Audit da Page `01 — Fundações` do Figma** via API REST (Figma Token de Acesso).
- [x] **Guia de Tokens**: Criado o documento [`docs/design-system/mobile-tokens.md`](file:///c:/Users/joao%20marcelo/Documents/afiliado-shopee/sistema-coleta/docs/design-system/mobile-tokens.md) com paleta de cores, escala tipográfica Geist, radii e elevações.
- [x] **Estilos Globais**: Atualizadas as variáveis CSS em [`src/_app/styles/globals.css`](file:///c:/Users/joao%20marcelo/Documents/afiliado-shopee/sistema-coleta/src/_app/styles/globals.css) com os tokens oficiais MJT:
  - `--color-primary`: `#4c916f` (Verde MJT)
  - `--color-primary-strong`: `#3d765a`
  - `--color-surface-green`: `#eef8f2`
  - `--color-surface-neutral`: `#eff2f0`
  - `--color-background`: `#f7f8f7`
  - `--color-border`: `#dee4e0`
- [x] **Validação**: `npm run typecheck` **0 erros**.

---

### 🟢 FASE 2: Componentes Base do Design System (`src/shared/ui/`) (CONCLUÍDO)
- [x] **`button.tsx`**: Variantes `primary` (`#4c916f`), `secondary`, `ghost`, `danger`, estado `isLoading` e touch target mínimo de 44px.
- [x] **`input.tsx`**: Campos de entrada com rótulos, helper text e validação de erro.
- [x] **`badge.tsx`**: Status chips do Figma (`collected`, `draft`, `canceled`, `in_service`, `ready`).
- [x] **`card.tsx`**: Estruturas de superfícies (`Card`, `CardHeader`, `CardContent`, `CardFooter`) estilizadas.
- [x] **`signature-pad.tsx`**: Canvas HTML5 responsivo com suporte touch para captura de assinatura do aceite.
- [x] **Validação**: `npm run typecheck` e `npm run lint` **0 erros**.

---

### 🟢 FASE 3: Telas Mobile do Fluxo de Coleta (`Page: 10 — Mobile / Coleta`) (CONCLUÍDO)
- [x] **`M02 · Nova coleta`**: Formulário de dados do cliente, busca por CPF/CNPJ ou novo cadastro e endereço da coleta implementado em [`new-collection-page.tsx`](file:///c:/Users/joao%20marcelo/Documents/afiliado-shopee/sistema-coleta/src/_pages/collection-drafts/ui/new-collection-page.tsx).
- [x] **`M03 · Itens`**: Lista e adição de itens com nota de condição, observações e autosave implementado em [`draft-items-page.tsx`](file:///c:/Users/joao%20marcelo/Documents/afiliado-shopee/sistema-coleta/src/_pages/collection-drafts/ui/draft-items-page.tsx).
- [x] **`M04 · Revisão`**: Tela de revisão dos dados do rascunho implementada em [`draft-review-page.tsx`](file:///c:/Users/joao%20marcelo/Documents/afiliado-shopee/sistema-coleta/src/_pages/collection-drafts/ui/draft-review-page.tsx) e rota [`app/(protected)/coletas/[id]/revisao/page.tsx`](file:///c:/Users/joao%20marcelo/Documents/afiliado-shopee/sistema-coleta/app/%28protected%29/coletas/%5Bid%5D/revisao/page.tsx).
- [x] **`M05 · Assinatura`**: Integração do `SignaturePad` com confirmação transacional em [`draft-signature-page.tsx`](file:///c:/Users/joao%20marcelo/Documents/afiliado-shopee/sistema-coleta/src/_pages/collection-drafts/ui/draft-signature-page.tsx) e rota [`app/(protected)/coletas/[id]/assinatura/page.tsx`](file:///c:/Users/joao%20marcelo/Documents/afiliado-shopee/sistema-coleta/app/%28protected%29/coletas/%5Bid%5D/assinatura/page.tsx).
- [x] **`M06 · Lista de coletas`**: Histórico mobile com busca por código `MJT-AAAA-NNNNNN` implementado em [`collections-list-page.tsx`](file:///c:/Users/joao%20marcelo/Documents/afiliado-shopee/sistema-coleta/src/_pages/collection-lifecycle/ui/collections-list-page.tsx) e rota [`app/(protected)/coletas/page.tsx`](file:///c:/Users/joao%20marcelo/Documents/afiliado-shopee/sistema-coleta/app/%28protected%29/coletas/page.tsx).
- [x] **`M07 · Responsável e signatário`**: Cadastro e confirmação de responsável em [`responsible-signatory-card.tsx`](file:///c:/Users/joao%20marcelo/Documents/afiliado-shopee/sistema-coleta/src/_pages/collection-drafts/ui/responsible-signatory-card.tsx).
- [x] **`M08 · Editar item`**: Modal de modificação de item individual em [`edit-item-modal.tsx`](file:///c:/Users/joao%20marcelo/Documents/afiliado-shopee/sistema-coleta/src/_pages/collection-drafts/ui/edit-item-modal.tsx).
- [x] **`M09 · Documentos`**: Histórico de recibos, QR Code e compartilhamento WhatsApp em [`collection-documents-page.tsx`](file:///c:/Users/joao%20marcelo/Documents/afiliado-shopee/sistema-coleta/src/_pages/collection-documents/ui/collection-documents-page.tsx).
- [x] **`M10 · Documento`**: Visualizador mobile do PDF imutável em [`document-viewer-page.tsx`](file:///c:/Users/joao%20marcelo/Documents/afiliado-shopee/sistema-coleta/src/_pages/collection-documents/ui/document-viewer-page.tsx) e rota [`app/(protected)/coletas/[id]/documentos/[docId]/page.tsx`](file:///c:/Users/joao%20marcelo/Documents/afiliado-shopee/sistema-coleta/app/%28protected%29/coletas/%5Bid%5D/documentos/%5BdocId%5D/page.tsx).
- [x] **`M11 · Configurações`**: Perfil do coletor e indicador PWA em [`collector-profile-page.tsx`](file:///c:/Users/joao%20marcelo/Documents/afiliado-shopee/sistema-coleta/src/_pages/company-settings/ui/collector-profile-page.tsx) e rota [`app/(protected)/configuracoes/page.tsx`](file:///c:/Users/joao%20marcelo/Documents/afiliado-shopee/sistema-coleta/app/%28protected%29/configuracoes/page.tsx).

---

### ⚪ FASE 4: Telas Mobile da Operação (`Page: 11 — Mobile / Operação`) (PENDENTE)
- [ ] **`M12 · Login`**: Tela de login mobile (`Page: 09 / M12`).
- [ ] **`O01 · Detalhe operacional`**: Visão operacional da coleta e timeline.
- [ ] **`O02 · Entrada na oficina`**: Registro de entrada na oficina MJT.
- [ ] **`O03 · Orçamento`**: Formulário de orçamento técnico.
- [ ] **`M13 · Aprovação`**: Tela de aprovação do cliente/gestor.
- [ ] **`M14 · Serviço`**: Acompanhamento da manutenção.
- [ ] **`M15 · Faturamento`**: Registro manual/fiscal de NF-e.
- [ ] **`O04 · Entrega ao cliente`**: Registro de entrega do equipamento.
- [ ] **`O05 · Cancelar ou reabrir`**: Fluxo auditável de cancelamento/reabertura.
- [ ] **`M16 · Ciclo do item`**: Timeline do ciclo de vida do item.

---

## ⚙️ Orientações Para Novas Sessões

1. **Pre-flight obrigatório**: Ler `sistema-coleta/AGENTS.md` antes de editar arquivos.
2. **Zero Any**: Proibido usar `any`, `@ts-ignore` ou criar arquivos duplicados/placeholders em `app/`.
3. **Validação**: Executar `npm run typecheck` e `npm run lint` após cada tela ou componente implementado.
