# Fase 1 — Coleta principal

## Objetivo

Permitir que a administradora/coletora da MJT crie, finalize e consulte uma coleta completa com garantia de integridade.

## Estado da Fase 1A

O nucleo tecnico foi implementado localmente e aplicado ao MVP em 20/08/2026, sem dados de negocio: a migration core `20260815090000_phase_1a_collection_core.sql` foi aplicada apos `supabase db push --dry-run`, seguida da migration aditiva de hardening de ACL `20260820225129_phase_1a_security_acl_hardening.sql`. As tabelas novas permanecem vazias nesta execucao. Nenhum outro projeto Supabase foi tocado.

O hardening remoto confirmou que as RPCs de aplicacao so podem ser executadas por
`authenticated`, a verificacao publica permanece disponivel para `anon` e
`authenticated`, e as rotinas de cleanup ficam restritas a `service_role`.
Os advisors ainda exibem avisos esperados para funcoes `SECURITY DEFINER` que
precisam ser chamadas pela aplicacao, os avisos informativos das tabelas
RPC-only sem policy e a protecao de senha vazada do Auth, que e uma configuracao
independente da Fase 1A.

### Gates reais do Supabase — ADIADOS

Os testes abaixo exigem um projeto Supabase isolado, identidades sinteticas e
Storage privado separado. Esse ambiente nao esta disponivel nesta execucao;
portanto, nenhum deles foi executado e a ausencia de evidencia remota nao deve
ser interpretada como aprovacao:

- **ADIADO — RLS entre organizacoes:** leitura, alteracao, referencia, upload e
  download cruzados entre duas organizacoes, incluindo acesso anonimo.
- **ADIADO — concorrencia PostgreSQL:** autosave, mutacoes de itens, uploads e
  duas finalizacoes simultaneas sob `FOR UPDATE` e `row_version`.
- **ADIADO — Storage privado:** ilegibilidade de objetos pendentes, acesso
  somente apos confirmacao e negacao de downloads por identidade/organizacao.
- **ADIADO — cleanup real:** expiracao/cancelamento de intents, remocao do
  objeto privado e confirmacao idempotente sem apagar intent confirmado.

Os testes locais de contrato e mocks verificam apenas a presenca dos contratos
necessarios. Eles nao substituem esses gates remotos. A migration foi aplicada
por decisao explicita do humano, mas os quatro gates reais permanecem adiados e
nao constituem aprovacao de concorrencia, RLS ou Storage em execucao real.

**Vs scan (06/09/2026):** B10–B15 (local, URL, fila, CTAs, worker/PDF) estao **feitos** no codigo; QR publico existe em Production (`MJT-2026-000002`). Os quatro gates remotos acima **continuam adiados**. UI de cadastro `/clientes` e de contatos/veiculos sao scan **5.12 / 5.13** (escopo, so com pedido). Ver [`system-scan-for-bugs.md`](../design-patterns/system-scan-for-bugs.md).

A Fase 1A (nucleo tecnico) esta aplicada. Telas Figma e template visual do PDF nao bloqueiam mais o ciclo coleta → numero → PDF → QR.

## Passos

1. Implementar clientes, contatos, enderecos e veiculos com validacao de CPF/CNPJ e telefone.
2. Implementar rascunho de coleta, autosave e lista de itens sem limite fixo.
3. Validar quantidade positiva, descricao do item e dados obrigatorios antes da finalizacao.
4. Implementar anexos/fotos opcionais em Storage privado.
5. Implementar aceite, identificacao do responsavel e captura de assinatura com nome e CNPJ.
6. Implementar comando transacional idempotente de finalizacao.
7. Gerar codigo `MJT-AAAA-NNNNNN` exclusivamente no servidor e registrar snapshot/document hash.
8. Implementar lista, filtros e detalhe da coleta com timeline.
9. Registrar eventos para criacao, edicao de rascunho, finalizacao, falha e cancelamento.
10. Implementar cancelamento com permissao, motivo e sem exclusao fisica, incluindo reabertura auditada sem reutilizar o numero oficial.

## Testes obrigatorios

- Duas finalizacoes simultaneas produzem codigos diferentes e sequenciais.
- Reenvio da mesma requisicao de finalizacao nao duplica a coleta nem o numero.
- Nao e possivel finalizar sem item, cliente, responsavel ou assinatura.
- Usuario sem papel permitido nao consulta nem altera coleta alheia.
- Cancelamento preserva codigo, itens, assinatura e auditoria.

## Criterios de aceite

- A administradora/coletora consegue concluir uma coleta pelo celular conectado.
- O escritorio encontra a guia por codigo e por cliente.
- Toda coleta finalizada mostra quem a criou, quem assinou e quando.
- Nenhuma acao normal permite apagar uma coleta finalizada.
