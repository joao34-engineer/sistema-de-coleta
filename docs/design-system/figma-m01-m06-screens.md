# Telas Figma adicionadas — 2026-09-07

Arquivo Figma: [Sistema de Coleta MJT](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ) (`akpo5W8c3ViA1hvjeqg9YJ`)  
Canvas: [15 — Protótipo navegável](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=23-107) (`23:107`)

Este lote adicionou **duas** telas do protótipo. Nenhuma outra frame do canvas entrou.

## Telas deste lote

| # | Tela no Figma | Node | Link | Rota no app |
| --- | --- | --- | --- | --- |
| 1 | **M01 · Início** | `229:1060` | [abrir no Figma](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=229-1060) | `/dashboard` |
| 2 | **M06 · Lista de coletas** | `232:38` | [abrir no Figma](https://www.figma.com/design/akpo5W8c3ViA1hvjeqg9YJ?node-id=232-38) | `/coletas` |

## O que cada tela recebeu

**M01 · Início (`/dashboard`)**

- Header com o logo PNG da login (`/logo/Logo_-_MJT-removebg-preview.png`), o mesmo que já estava em Início.
- Data sem ano, headline `Organize a rota` / `sem perder o controle.`
- Card de resumo, CTA **Nova coleta** à esquerda (`PendingNavLink`).
- Duas atividades (pílula → código → cliente). Pílula **Pronto** para `ready`.
- Sem Ver rascunhos, card emissor ou Sair no header.

**M06 · Lista de coletas (`/coletas`)**

- Header com o **mesmo** logo PNG da login (antes Coletas usava o quadrado verde “MJT”).
- Placeholder `Buscar por número ou cliente`.
- 8 chips com wrap: Todos, Rascunho, Coletada, Em reparo, Pronta, Faturada, Entrega parcial, Cancelada.
- Prefetch e `pendingFilter` da Fase 1 de performance mantidos.
- Linhas 88px; rascunho `sem número oficial`; status em texto.
- Chip **Pronta** = só `ready`; na linha o texto é **Pronto**.

## Chrome que não foi reescrito

Header compartilhado, bottom nav, `PendingNavLink`, `loading.tsx` e `list_collections` ficaram como já estavam, para não desfazer a Fase 1 de performance.

| No Figma | No app | Por quê |
| --- | --- | --- |
| Texto “MJT” no header | PNG real da login, em Início **e** Coletas | Pedido: o logo da login nas duas telas |
| Bottom nav só texto | Nav existente (ícone + `PendingNavLink`) | Não mexer no chrome compartilhado nem nos shells |
| `Cliente · N itens` | Nome do cliente | Sem alterar `list_collections` |

## Fora deste lote

Frames do mesmo canvas que **não** foram adicionados: login, captura, oficina, documentos, configurações e as demais telas M02–M05 / M07+.
