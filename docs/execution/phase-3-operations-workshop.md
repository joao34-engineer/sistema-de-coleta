# Fase 3 — Operacao de oficina e faturamento

## Objetivo

Dar continuidade rastreavel a coleta apos sua retirada, sem transformar o V1 em um ERP completo.

## Passos

1. Implementar transicoes de estado autorizadas conforme `data-and-rules.md`.
2. Criar painel de pendencias por estado, periodo e responsavel.
3. Registrar entrada na oficina, orcamento, aprovacao, execucao, pronto e entrega como eventos.
4. Criar ordem de servico vinculada a coleta quando a operacao exigir detalhes adicionais.
5. Registrar referencia manual da NF-e: numero, serie, data e observacao; nao emitir a nota.
6. Exibir timeline unificada para escritorio, oficina e financeiro, respeitando permissoes.
7. Criar relatorios operacionais basicos de volume e tempo de ciclo.

## Regras

- Uma NF-e referencia a coleta; ela nao substitui sua guia nem altera itens assinados.
- Transicoes nao devem ser atalhadas no banco por edicao manual; devem passar por comando auditado.
- Caso uma coleta nao vire servico, marcar `nao_aprovada` ou `cancelada` com motivo, preservando o documento.

## Criterios de aceite

- A equipe identifica em segundos onde cada coleta esta no fluxo.
- Financeiro consegue localizar a coleta pela referencia fiscal e vice-versa.
- Relatorios nao expõem dados fora da permissao do usuario.
