# Plano de Alinhamento às 12 Páginas Mobile do Figma (`sistema-coleta`)

> **Data de Atualização**: 22 de Agosto de 2026  
> **Status**: **PARCIAL** (telas de coleta reais alinhadas; telas de operação removidas em quarentena; S01–S05 parcialmente integrados; A02 desktop inexistente)  
> **Link Canônico do Figma**: [Design System e Fluxos — Mobile](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ/Sistema-de-Coleta-MJT-%E2%80%94-Design-System-e-Fluxos?node-id=8-9&t=qZKnYfCVSs22b6NG-1)

---

## 📱 Mapeamento das Páginas Mobile do Figma

| # | Nome no Figma | Nó Figma | Componentes Implementados | Status |
|---|---|---|---|---|
| 01 | **Cover / Capa** | `8:2` | Identidade visual, tokens de cor e typography scale Geist | ✅ Concluído |
| 02 | **01 · Visão geral das telas** | `8:8` | Mapeamento completo dos fluxos M01 a M16, O01 a O05, Q01 a Q02, S01 a S05 | ✅ Concluído |
| 03 | **02 · Tokens e Fundamentos** | `8:9` | CSS Tokens (`globals.css`), cores `#28312b`, `#748078`, `#4c916f`, `#3b7a5b`, `#f7f8f7`, `#dee4e0` + aliases semânticos (`--color-surface-bg`, `--color-card-bg`, `--color-text-primary`, `--color-text-muted`) | ✅ Concluído |
| 04 | **03 · Componentes de Interface** | `8:11` | `Button` (52px, radius 12px), `Input` (48px/52px, radius 12px), `Card` (bg #fff, radius 16px), `Badge` (pill 999px) | ✅ Concluído |
| 05 | **04 · Header e Navegação (PWA)** | `8:12` | `MobilePageHeader` (`topbar` 390x88px, logo mark MJT 38x32px/64x64px), `MobileBottomNav` (390x84px, radius 18px) — bottom-nav migrada de emojis para ícones SVG do Figma em 22/08/2026; item "Documentos" oculto até existir rota global real (Onda 3/Fase 3) | ✅ Concluído |
| 06 | **05 · Fluxo de Coleta (Rascunho a Assinatura)** | `27:2` | `M01 · Início`, `M02 · Nova Coleta`, `M03 · Itens`, `M04 · Revisão`, `M05 · Assinatura` — fluxo real com dados do banco (Onda 1 do RECOVERY-PLAN) | ✅ Concluído |
| 07 | **09 · A01 · Login mobile** | `8:10` | `LoginPage` & `LoginForm` com Hero *Entre para continuar.* (24px W600) e inputs 48px/52px. **A02 desktop: NUNCA implementado** | ⚠️ Parcial |
| 08 | **10 · M01 a M12 · Operador e cliente** | `8:10` | `CollectionsListPage` (M06), `ResponsibleSignatoryCard` (M07), `EditItemModal` (M08), `CollectionDocumentsPage` (M09), `CollectorProfilePage` (M11) — dados reais | ✅ Concluído |
| 09 | **11 · O01 a O05 / M13 a M16 · Oficina** | `8:10` | Telas fake (submits simulados, mocks hardcoded "Metalúrgica Salvat"/"Motor WEG") **REMOVIDAS DO BUILD em 22/08/2026** conforme RECOVERY-PLAN Onda 2. Contratos Zod preservados em `src/_pages/collection-operations/model/contracts.ts` para a implementação real (Fase 3). Histórico completo no git | ❌ Removido (fake) |
| 10 | **13 · Q01 / Q02 · Verificação pública (QR Code)** | `8:10` | `PublicVerificationPage` (Q01 Guia Autêntica & Q02 Não Encontrada) com layout `390x844px` e restrição LGPD. Header revisado do node `23:361` replicado em 22/08/2026 | ✅ Concluído |
| 11 | **14 · S01 a S05 · Estados e handoff** | `8:10` | `MobileStatePanel` (`S01 Loading`, `S02 Empty`, `S03 Error`, `S04 Success`, `S05 Confirmation`) — integrado aos estados vazio/erro das telas reais em 22/08/2026 (listagem, documentos, nova coleta, assinatura); loading nativo do App Router mantido | ⚠️ Parcial |
| 12 | **15 · Handover e notas de design** | `8:10` | Documentação alinhada em `docs/design-system/mobile-tokens.md`; dumps JSON brutos do Figma fora do git (mantidos localmente) | ✅ Concluído |

---

## 🎯 Garantias de Qualidade & Validação

Validação executada em 22/08/2026 após a Onda 2 do [RECOVERY-PLAN](../RECOVERY-PLAN.md) — saídas reais coladas:

```text
npx steiger src
→ No problems found!

npm run lint
→ (saída colada no RECOVERY-PLAN.md)

npm run typecheck
→ (saída colada no RECOVERY-PLAN.md)

npm run test
→ (saída colada no RECOVERY-PLAN.md)
```

O status "CONCLUÍDO 100%" anterior a 22/08/2026 era falso: steiger falhava, telas da oficina eram cenografia com dados fictícios e o A02 desktop nunca existiu.
