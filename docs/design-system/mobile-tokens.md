# Guia de Tokens do Design System — Mobile (Figma -> System)

Este documento registra os **Design Tokens** canônicos extraídos diretamente do arquivo oficial no Figma (*Sistema de Coleta MJT — Design System e Fluxos*).

> 📌 **Plano de Execução por Fases**: Para acompanhar o progresso detalhado de implementação de cada tela mobile, consulte o documento [`docs/design-system/mobile-execution-plan.md`](file:///c:/Users/joao%20marcelo/Documents/afiliado-shopee/sistema-coleta/docs/design-system/mobile-execution-plan.md).

---

## 🎨 1. Paleta de Cores (Color Tokens)

| Token CSS | Valor HEX | Uso / Semântica no Design System |
| :--- | :--- | :--- |
| `--mjt-primary` | `#4c916f` | Cor primária da marca MJT (Botões de ação principal, destaques) |
| `--mjt-primary-hover` | `#3d765a` | Estado hover/active de botões primários |
| `--mjt-surface-green` | `#eef8f2` | Fundo suave de badges ativas, marcas d'água e itens selecionados |
| `--mjt-surface-neutral` | `#eff2f0` | Fundo neutro secundário para ícones, avatares e botões ghost |
| `--mjt-surface-bg` | `#f7f8f7` | Fundo global de páginas e telas da aplicação |
| `--mjt-card-bg` | `#ffffff` | Fundo de superfícies elevadas, formulários e cartões |
| `--mjt-border` | `#dee4e0` | Cor padrão de bordas de cards, inputs e divisores |
| `--mjt-text-primary` | `#111827` | Texto principal, títulos e campos preenchidos |
| `--mjt-text-muted` | `#6b7280` | Subtítulos, descrições secundárias e placeholders |
| `--mjt-status-draft` | `#f59e0b` | Status rascunho / pendente |
| `--mjt-status-collected` | `#4c916f` | Status concluído / coletado |
| `--mjt-status-canceled` | `#ef4444` | Status cancelado / erro |

---

## 🔤 2. Tipografia (Typography Tokens)

- **Família de Fontes**: `Geist`, `-apple-system`, `BlinkMacSystemFont`, `"Segoe UI"`, `Roboto`, `sans-serif`.
- **Pesos Disponíveis**:
  - `Geist 400` (Regular)
  - `Geist 600` (Semibold / Medium Header)

### Escala Tipográfica (Mobile & Desktop):
- **Display / Titulo Principal**: `30px` (Line height: `1.2`, Weight: `600`)
- **Título Nível 1**: `22px` - `28px` (Weight: `600`)
- **Título Nível 2 / Card Header**: `18px` - `20px` (Weight: `600`)
- **Corpo / Subtítulos**: `14px` - `16px` (Weight: `400` / `600`)
- **Auxiliar / Labels de Campos**: `12px` - `13px` (Weight: `400` / `600`)
- **Micro Labels / Badges**: `10px` (Weight: `600`)

---

## 📐 3. Espaçamento, Raio e Elevações (Spacing & Radii)

- **Border Radii (Arredondamento)**:
  - `--radius-sm`: `6px` (Inputs, Badges, Botões menores)
  - `--radius-md`: `10px` / `12px` (Cards, Modais, Contêineres)
  - `--radius-lg`: `16px` (Bottom Sheets, Popovers mobile)
- **Touch Targets Mobile**: Mínimo de `44px` x `44px` para todos os botões e áreas clicáveis no celular.
- **Espaçamentos Internos (Paddings)**:
  - Card Padding: `16px` (Mobile), `24px` (Desktop)
  - Screen Padding: `16px` nas laterais para mobile (gutter)
