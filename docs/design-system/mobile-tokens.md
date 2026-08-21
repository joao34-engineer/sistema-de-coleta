# Guia Canônico de Tokens do Design System — Mobile (Figma -> System)

Este documento registra os **Design Tokens** e especificações canônicas extraídos diretamente do arquivo oficial do Figma (**Sistema de Coleta MJT — Design System e Fluxos**, chave `akpo5W8c3ViA1hvjeqg9YJ`), incluindo as páginas `01 — Fundações`, `02 a 05 — Componentes` e `10 a 11 — Mobile / Coleta e Operação`.

> 📌 **Configuração do Figma MCP Server**:
> O token de acesso e a configuração do MCP estão salvos em:
> `c:\Users\joao marcelo\Documents\afiliado-shopee\.cursor\mcp.json` (`FIGMA_PERSONAL_ACCESS_TOKEN`).

---

## 🎨 1. Paleta de Cores & Contraste (Color Tokens)

*Light Mode — Verde suave e cinzas neutros para o sistema operacional de coleta e oficina.*

| Token CSS | Valor HEX | Função Semântica no Figma |
| :--- | :--- | :--- |
| `--mjt-primary` | `#4c916f` | Verde da marca MJT (Ação principal, botões de confirmação, marcas e destaques) |
| `--mjt-primary-strong` | `#3b7a5b` | Estado hover/active de botões primários e links destacados |
| `--mjt-primary-dark` | `#31674c` | Accent verde-escuro para texto de badges e contraste |
| `--mjt-surface-green` | `#eef8f2` | Verde suave para fundo de badges ativas, seleção e marcas d'água |
| `--mjt-surface-bg` | `#f7f8f7` | Canvas global (Fundo de telas mobile `390x844px`) |
| `--mjt-card-bg` | `#ffffff` | Superfície elevada para cards, formulários, modais e barra de navegação |
| `--mjt-border` | `#dee4e0` | Cor padrão de bordas de cartões, inputs e divisores de seção |
| `--mjt-border-subdued` | `#a4afa8` | Bordas secundárias e estados desabilitados de contorno |
| `--mjt-text-primary` | `#28312b` | **Texto Principal / Títulos** (Verde-escuro profundo / grafite MJT — 116 refs no Figma) |
| `--mjt-text-muted` | `#748078` | **Texto Secundário / Descrições** (Cinza-esverdeado suave — 126 refs no Figma) |
| `--mjt-surface-neutral` | `#eff2f0` | Fundo neutro secundário para estados desabilitados e botões ghost |
| `--mjt-status-draft-bg` | `#fff8ec` | Fundo de status Em Orçamento / Em Reparo / Rascunho |
| `--mjt-status-draft-text` | `#a36b2c` | Texto de status Em Orçamento / Em Reparo |
| `--mjt-status-cancel-bg` | `#fdf2f1` | Fundo de status Cancelado / Erro |
| `--mjt-status-cancel-text` | `#ba5b52` | Texto de status Cancelado / Erro |

---

## 🔤 2. Tipografia (Typography Tokens)

- **Família Canônica de Fontes**: `Geist`, `-apple-system`, `BlinkMacSystemFont`, `sans-serif`.
- **Pesos Utilizados**:
  - `Geist 400` (Regular)
  - `Geist 500` (Medium)
  - `Geist 600` (SemiBold)

### Escala Tipográfica Oficial do Figma:
| Categoria Figma | Tamanho (px) | Peso (Weight) | Uso nas Telas Mobile |
| :--- | :--- | :--- | :--- |
| **Display 36** | `36px` | `600` (SemiBold) | Títulos da marca / Hero da capa |
| **Hero Title** | `30px` / `32px` | `600` (SemiBold) | Cabeçalhos de destaque / Marca MJT |
| **Título 24** | `24px` | `600` (SemiBold) | Títulos principais de tela (ex: *Entre para continuar*, *R$ 220,00*) |
| **Título Nível 2** | `22px` | `600` (SemiBold) | Nomes de equipamentos e seções de destaque |
| **Título Nível 3 / Header** | `18px` / `20px` | `600` (SemiBold) | Títulos de Cards e cabeçalho de navegação (ex: *MJT*, *Coleta*) |
| **Subhead / Subtítulo** | `16px` | `600` / `400` | Nomes de itens e destaque de botões médios |
| **Corpo Padrão** | `14px` | `600` / `400` | Texto principal de formulários, botões e listas |
| **Subtext / Helper** | `13px` | `600` / `500` / `400` | Detalhes de itens, razões sociais e sub-rótulos |
| **Legenda / Label** | `12px` | `600` / `400` | Rótulos de campos (*E-mail*, *Senha*, *CPF/CNPJ*), observações e notas |
| **Micro Label / Badge** | `11px` | `600` / `400` | Chips de status e avisos de rodapé (*{{TEXTO_JURIDICO_RECIBO}}*) |

---

## 📐 3. Estrutura de Layout, Radii e Componentes Mobile

### Dimensões & Grade Mobile:
- **Largura do Canvas Mobile**: `390px` (Proporção standard `390x844px`).
- **Grade de Base**: `4px` (Espaçamentos: `4px` · `8px` · `12px` · `16px` · `24px` · `32px` · `48px`).
- **Área Mínima de Toque (Touch Target)**: `44px` x `44px` para todos os botões e áreas interativas no celular.

### Componentes Chave do Figma:
1. **MJT Mark (Logo Icon)**:
   - Dimensão: `64px` x `64px`
   - Background: `#4c916f`
   - Border Radius: `18px`
   - Texto: `MJT` (`18px`, Geist `600`, Cor: `#ffffff`)

2. **Mobile Bottom Navigation**:
   - Dimensão: `390px` x `84px`
   - Background: `#ffffff`
   - Border Top: `1px solid #dee4e0`
   - Border Radius Superior: `18px`

3. **Botões Médios (Medium Buttons)**:
   - Altura: `52px` (Largura flexível ou `150px`)
   - Border Radius: `12px`
   - Primário: Background `#4c916f` (ou `#000000` em variações), Texto `#ffffff` (`14px`, Geist `600`)
   - Secundário: Background `#ffffff`, Borda `#dee4e0`, Texto `#28312b`
   - Desabilitado: Background `#eff2f0`, Texto `#748078`

4. **Cartões & Superfícies (Cards)**:
   - Background: `#ffffff`
   - Borda: `1px solid #dee4e0`
   - Border Radii: `14px` / `16px` / `18px`
   - Padding Interno: `16px` (Mobile)

5. **Arredondamento por Camada (Border Radii Scale)**:
   - `8px` / `10px`: Badges, tags, chips.
   - `12px`: Botões médios, campos de entrada (inputs).
   - `14px` / `16px` / `18px`: Cards, modais e barra inferior de navegação.
   - `28px`: Moldura externa dos contêineres e telas mobile (`390x844px`).
