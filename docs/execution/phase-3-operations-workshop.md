# Fase 3 — Operacao de oficina e faturamento

## Objetivo

Dar continuidade rastreavel a coleta apos sua retirada, sem transformar o V1 em um ERP completo.

## Estado real (22/08/2026)

**NAO INICIADA.** Auditoria do RECOVERY-PLAN confirmou que as telas O01–O05/M13–M16
que existiam em `src/_pages/collection-operations/ui/` eram cenografia (submits
simulados com `setTimeout` e mocks hardcoded) e foram REMOVIDAS DO BUILD na
Onda 2, junto com as rotas `app/(protected)/coletas/[id]/{operacao,oficina,
orcamento,aprovacao,servico,faturamento,entrega,itens/[itemId]/ciclo}`.

O que existe de aproveitavel para a implementacao real (ordem obrigatoria da
Onda 3 — ver [RECOVERY-PLAN](../RECOVERY-PLAN.md)):

1. Contratos Zod prontos e testados: `src/_pages/collection-operations/model/contracts.ts` (7 schemas) + `tests/unit/mobile-phase4-operations.test.ts`.
2. Eventos append-only e transicoes ja modeladas em `docs/architecture/data-and-rules.md`.
3. Nenhuma migration da Fase 3 existe ainda (`supabase/migrations/` para na Fase 2).
4. Insumo canonico de identidade e catalogo (registrado na Onda 2.5, 22/08/2026):
   `docs/tabela-de-preco/*.pdf` — tabela oficial da MJT Tornearia com 63 servicos
   e precos BRL, base para o catalogo dos orcamentos O03; dados de emissao do PDF
   oficial: CNPJ 28.316.431/0001-80, Estrada do Cabuçu, 1190 – Campo Grande/RJ,
   tels (21) 98663-8936 / (21) 97674-3502, mjt.mjtornearia@gmail.com.
   Nao criar migration nem catalogo no banco nesta etapa — apenas consumir como
   referencia quando a Onda 3 implementar orcamentos.

## Passos

1. Implementar transicoes de estado autorizadas conforme `data-and-rules.md`.
2. Criar painel de pendencias por estado, periodo e responsavel.
3. Registrar a entrada item a item na oficina propria fixa da MJT, orcamento, aprovacao, reparo, pronto e entrega como eventos.
4. Criar ordem de servico vinculada a coleta quando a operacao exigir detalhes adicionais.
5. Registrar referencia manual da NF-e: numero, serie, data e observacao; nao emitir a nota.
6. Exibir timeline unificada para escritorio, oficina e financeiro, respeitando permissoes.
7. Criar relatorios operacionais basicos de volume e tempo de ciclo.
8. Gerar termo digital de entrega com os itens prontos, assinatura do cliente com nome e CNPJ e suporte a entregas parciais.

## Regras

- Uma NF-e referencia a coleta; ela nao substitui sua guia nem altera itens assinados.
- Transicoes nao devem ser atalhadas no banco por edicao manual; devem passar por comando auditado.
- Caso uma coleta nao vire servico, marcar `nao_aprovada` ou `cancelada` com motivo, preservando o documento.
- A entrega parcial registra somente os itens efetivamente entregues; os itens restantes permanecem pendentes ate uma nova entrega.

## Criterios de aceite

- A equipe identifica em segundos onde cada coleta esta no fluxo.
- Financeiro consegue localizar a coleta pela referencia fiscal e vice-versa.
- Relatorios nao expõem dados fora da permissao do usuario.
