# Documentacao do Sistema de Coleta MJT

## Status e convencoes

Esta documentacao e a fonte de planejamento para o projeto independente `sistema-coleta`. O sistema sera implementado por fases; concluir uma fase inclui seus criterios de aceite, testes e atualizacao documental.

O codigo da fundacao da Fase 0 ja existe e esta conectado ao Supabase remoto unico do MVP. O status de uma fase deve ser confirmado pelos gates tecnicos e operacionais, nao por documentos antigos que afirmem que o scaffold ainda nao foi criado.

- "V1" e o primeiro uso real em campo, nao uma demonstracao.
- Uma guia finalizada e um registro documental: nao se apaga nem se sobrescreve.
- "Cliente" pode ser pessoa juridica ou pessoa fisica.
- A guia de coleta nao substitui documento fiscal.

## Entrada obrigatoria

Antes de qualquer implementacao, ler [AGENTS.md](../AGENTS.md), este indice e somente os documentos da tarefa atual. Isso evita carregar contexto irrelevante e mantem as decisoes consistentes.

## Mapa tematico

| Assunto | Documento |
| --- | --- |
| Produto, usuarios e escopo | [product/vision-and-scope.md](product/vision-and-scope.md) |
| Fluxos de campo e experiencia mobile | [product/mobile-workflows.md](product/mobile-workflows.md) |
| Arquitetura geral | [architecture/solution-design.md](architecture/solution-design.md) |
| FSD e organizacao de codigo | [architecture/fsd.md](architecture/fsd.md) |
| Dados e regras imutaveis | [architecture/data-and-rules.md](architecture/data-and-rules.md) |
| Next.js, App Router e PWA | [nextjs-pwa.md](nextjs-pwa.md) |
| TypeScript e contratos | [typescript.md](typescript.md) |
| Supabase, migrations, RLS e Storage | [supabase.md](supabase.md) |
| Backup e restore (Chat 5) | [runbook-backup-restore.md](runbook-backup-restore.md) · ADR [0010](decisions/0010-backup-restore-isolated.md) |
| Seguranca, privacidade e evidencias | [security.md](security.md) |
| Contratos HTTP da Fase 1A | [http-api.md](http-api.md) |
| Clean code e fronteiras | [coding-standards.md](coding-standards.md) |
| Testes e validacao | [testing.md](testing.md) |
| Decisoes de arquitetura | [decisions/](decisions/) — DAL unica: [0009](decisions/0009-data-access-layer.md) (**congelada**) |
| Organizacao do codigo / DAL | [design-patterns/architecture-improvement.md](design-patterns/architecture-improvement.md) — decisao DAL normativa; fases A–H planned |
| Plano de performance (informative) | [design-patterns/performance.md](design-patterns/performance.md) |
| Inventario de bugs (scan 29/08/2026) | [design-patterns/system-scan-for-bugs.md](design-patterns/system-scan-for-bugs.md) — codigo Fases 0–5 fechado (5.6 entrega desde Pronto); 5.7/5.12/5.13 **adiados**; **nao reimplementar** linhas **feito** |
| Telas Figma M01 / M06 (2026-09-07) | [design-system/figma-m01-m06-screens.md](design-system/figma-m01-m06-screens.md) — `/dashboard` e `/coletas` vs frames `229:1060` e `232:38` |

Os skills locais ficam em `.agents/skills/`: `$mjt-supabase` para banco/Auth/RLS/Storage e `$mjt-nextjs-pwa` para App Router/PWA. Leia o `SKILL.md` somente quando o gatilho da tarefa se aplicar.

## Indice de execucao

| Ordem | Documento | Resultado |
| --- | --- | --- |
| 0 | [Fundacao](execution/phase-0-foundation.md) | Repositorio, ambientes, identidade e base tecnica |
| 0.5 | [Especificacao funcional e UX](execution/phase-0.5-functional-ux-specification.md) | Requisitos de tela, fluxos e handoff para Figma |
| 1 | [Coleta principal](execution/phase-1-collection-core.md) | Cadastro, itens, assinatura e numero oficial |
| 2 | [Documento e compartilhamento](execution/phase-2-documents-sharing.md) | PDF, QR, consulta e envio |
| 3 | [Operacao de oficina](execution/phase-3-operations-workshop.md) | Timeline, estados e referencia de faturamento |
| 4 | [Confiabilidade e lancamento](execution/phase-4-hardening-launch.md) | Chats 1–5 ferramentas; prova humana de restore adiada; faltam campo e go-live formal |
| — | [Pending panel leftover discard](execution/vercel-pending-panel-dead-actions-fix-prompt.md) | Closed 2026-09-06: panel + `immutable_record` purge on Production |
| — | [Fase 3 auth + leftovers + Fase 5](execution/fase3-5-ready-to-implement-fix-plan.md) | **Closed** 2026-09-06 (`30d8621`). **5.6** no remoto + Production (`20260906210000`). Cursor `20260906220000` no remoto. 5.7 / 5.12 / 5.13 adiados |
| — | [Entrega parcial em reparo + leftovers](execution/workshop-partial-delivery-leftovers.md) | **Active** 2026-09-12. PR 1–4 e L1–L9 em código; L1+L2+L4+L6 **no remoto** até `20260907240000`; L5/L8/L9 **sem** schema novo (L5 ainda fora do CI). PR 5 **no remoto** (`20260912100000`). Auditoria: [workshop-leftovers-audit-2026-09-07.md](design-patterns/workshop-leftovers-audit-2026-09-07.md) |

Nenhum documento de execucao deve ultrapassar 500 linhas. Novas decisoes devem ser registradas em `decisions/` ou no documento tematico correspondente, nao diluidas em prompts ou codigo.
