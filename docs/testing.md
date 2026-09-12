# Testes e validacao

## Pilares

| Nivel | Verifica |
| --- | --- |
| Unitario | Regras de estado, formatacao, validacao e mappers puros |
| Integracao | Comandos, banco, RLS, Storage e geracao documental em ambiente isolado |
| Componente | Comportamento acessivel de formularios, erros e assinatura |
| E2E | Coleta de ponta a ponta, permissao, PDF, QR e compartilhamento |
| Campo/PWA | Offline, reconexao, instalacao e atualizacao em aparelhos reais |

## Casos nao negociaveis

- Concorrencia: duas finalizacoes nao repetem codigo; retry retorna resultado idempotente.
- Autorizacao: anonimo e usuario sem papel nao leem nem escrevem coleta/documento/evidencia.
- Imutabilidade: correcao/cancelamento preserva versao original e evento de auditoria.
- Documento: PDF vem do snapshot e QR nao expoe dados sensiveis.
- Arquivo: tipo/tamanho invalidos sao rejeitados; objeto privado nao abre sem permissao.
- Offline: rascunho sobrevive a reabertura, sincroniza uma vez e nao emite numero antes do servidor.

## Comandos de CI

O scaffold deve expor scripts consistentes: `lint`, `typecheck` (`tsc --noEmit`), `test`, `test:e2e` e `build`. O CI executa ao menos lint, typecheck, testes alterados/relevantes e build; producao usa instalacao limpa pelo lockfile. SQL de leftovers (ex.: L4 `20260907230000`, PR 4 `20260907010000`, PR 5 `20260912100000`) entra no CI via testes textuais Vitest (`tests/unit/phase-5-*-migration.test.ts`). pgTAP em `supabase/tests/` nao esta no `package.json` nem no CI; L5 adicionou `phase_5_deliver_mid_repair_test.sql` e `phase_5_cancel_reopen_service_order_test.sql`; PR 5 adicionou `phase_5_workshop_check_in_missing_items_test.sql` para `supabase test db` local. D5 (hub vs folha) cobre `tests/unit/company-settings-chrome.test.ts`, as paginas de componente de configuracoes e o `heading` da folha em `tests/e2e/administrator-smoke.spec.ts`.

## Dados de teste

Usar fixtures sinteticas e banco/Storage isolados. Nunca apontar testes, seed ou reset para producao. Testes de RLS devem criar identidades representando papeis reais, e nao burlar a policy com service role.

## Definicao de pronto

Uma capacidade esta pronta quando comportamento, acesso negado, falha e recuperacao foram testados; a documentacao/ADR foi atualizada quando houve contrato novo; e os comandos de validacao aplicaveis passam local e no CI.
