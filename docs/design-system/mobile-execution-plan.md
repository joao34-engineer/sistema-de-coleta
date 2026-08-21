# Plano Definitivo de Alinhamento 100% Fiel às 12 Páginas Mobile do Figma (`sistema-coleta`)

> **Data de Atualização**: 21 de Agosto de 2026  
> **Status**: **CONCLUÍDO (100% Alinhado ao Figma)**  
> **Link Canônico do Figma**: [Design System e Fluxos — Mobile](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ/Sistema-de-Coleta-MJT-%E2%80%94-Design-System-e-Fluxos?node-id=8-9&t=qZKnYfCVSs22b6NG-1)

---

## 📱 Mapeamento Completo das 12 Páginas Mobile do Figma

| # | Nome no Figma | Nó Figma | Componentes Implementados | Status |
|---|---|---|---|---|
| 01 | **Cover / Capa** | `8:2` | Identidade visual, tokens de cor e typography scale Geist | ✅ Concluído |
| 02 | **01 · Visão geral das telas** | `8:8` | Mapeamento completo dos fluxos M01 a M16, O01 a O05, Q01 a Q02, S01 a S05 | ✅ Concluído |
| 03 | **02 · Tokens e Fundamentos** | `8:9` | CSS Tokens (`globals.css`), cores `#28312b`, `#748078`, `#4c916f`, `#3b7a5b`, `#f7f8f7`, `#dee4e0` | ✅ Concluído |
| 04 | **03 · Componentes de Interface** | `8:11` | `Button` (52px, radius 12px), `Input` (48px/52px, radius 12px), `Card` (bg #fff, radius 16px), `Badge` (pill 999px) | ✅ Concluído |
| 05 | **04 · Header e Navegação (PWA)** | `8:12` | `MobilePageHeader` (`topbar` 390x88px, logo mark MJT 38x32px/64x64px), `MobileBottomNav` (390x84px, radius 18px) | ✅ Concluído |
| 06 | **05 · Fluxo de Coleta (Rascunho a Assinatura)** | `27:2` | `M01 · Início`, `M02 · Nova Coleta`, `M03 · Itens`, `M04 · Revisão`, `M05 · Assinatura` | ✅ Concluído |
| 07 | **09 · A01 · Login mobile** | `8:10` | `LoginPage` & `LoginForm` com Hero *Entre para continuar.* (24px W600) e inputs 48px/52px | ✅ Concluído |
| 08 | **10 · M01 a M12 · Operador e cliente** | `8:10` | `CollectionsListPage` (M06), `ResponsibleSignatoryCard` (M07), `EditItemModal` (M08), `CollectionDocumentsPage` (M09), `CollectorProfilePage` (M11) | ✅ Concluído |
| 09 | **11 · O01 a O05 / M13 a M16 · Oficina** | `8:10` | `OperationalDetailPage` (O01), `WorkshopEntryPage` (O02), `BudgetFormPage` (O03), `BudgetApprovalPage` (M13), `ServiceProgressPage` (M14), `BillingReferencePage` (M15), `CustomerDeliveryPage` (O04), `CancelReopenModal` (O05), `ItemLifecyclePage` (M16) | ✅ Concluído |
| 10 | **13 · Q01 / Q02 · Verificação pública (QR Code)** | `8:10` | `PublicVerificationPage` (Q01 Guia Autêntica & Q02 Não Encontrada) com layout `390x844px` e restrição LGPD | ✅ Concluído |
| 11 | **14 · S01 a S05 · Estados e handoff** | `8:10` | `MobileStatePanel` (`S01 Loading`, `S02 Empty`, `S03 Error`, `S04 Success`, `S05 Confirmation`) | ✅ Concluído |
| 12 | **15 · Handover e notas de design** | `8:10` | Documentação alinhada em `docs/design-system/mobile-tokens.md` | ✅ Concluído |

---

## 🎯 Garantias de Qualidade & Validação

- **Typecheck**: `npm run typecheck` → **0 Erros**
- **Linter**: `npm run lint` → **0 Avisos / 0 Erros**
- **Testes Unitários**: `npx vitest run` → **100% Passando (10/10)**
