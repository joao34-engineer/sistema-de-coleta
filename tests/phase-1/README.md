# QA adversarial — Fase 1A

Esta pasta concentra testes de contrato, fixtures sintéticas e um harness de
integração remoto. A suíte local é a única executada por padrão. Nenhum teste
faz `reset`, `truncate`, `drop`, apaga objeto ou consulta o MVP.

## Testes locais

- `phase-1-schema-contract.test.ts` verifica entidades, RLS, Storage privado,
  imutabilidade e comandos da migration.
- `phase-1-hardening-contract.test.ts` verifica os contratos que bloquearam a
  revisão: `legal_name`, versão positiva, RPCs atômicas de item/upload,
  snapshot congelado com evidências, cursor temporal, endereço HTTP e erro
  `idempotency_key_required`.
- `phase-1-validation-contract.test.ts` cobre validação pura e exige
  `expectedVersion >= 1`.
- `phase-1-review-regressions.test.ts` mantém os gates da revisão independente:
  DTO de evidência com SHA-256, cliente atual em rascunho versus snapshot
  congelado, staging ilegível, compensação apenas antes do commit, job de
  limpeza, criação atômica cliente/endereço com uma única primária e logging
  seguro em respostas 5xx.

Os testes de contrato podem falhar enquanto os implementadores ainda estão
alterando migration, tipos ou handlers. Isso é intencional: uma falha é um
bloqueador de integração, não uma justificativa para enfraquecer o teste.

## Gates reais — ADIADOS

Por ausência de um projeto Supabase isolado, os seguintes gates estão
**ADIADOS**, não aprovados. Nenhum teste remoto foi executado nesta fase:

- **ADIADO — RLS entre organizações:** dois usuários normais em organizações
  distintas, além do acesso anônimo.
- **ADIADO — concorrência PostgreSQL:** corridas reais de autosave, itens,
  uploads e finalização com bloqueio transacional.
- **ADIADO — Storage privado:** leitura negada de objeto pendente, leitura
  liberada apenas após confirmação e isolamento por organização.
- **ADIADO — cleanup real:** remoção do objeto expirado/cancelado e ack
  idempotente no Storage privado.

Os testes locais são determinísticos e verificam contratos, fixtures e
comportamento de harness; não são evidência de execução no PostgreSQL, RLS ou
Storage. A migration core e a migration aditiva de ACL foram aplicadas ao MVP
em 20/08/2026 após `supabase db push --dry-run`, sem inserir dados de negócio.
Os quatro gates acima continuam registrados como adiados porque não existe
ambiente isolado autorizado; a aplicação não transforma os testes locais em
aprovação remota.

## Harness remoto — somente ambiente isolado futuro

O projeto não possui atualmente um ambiente remoto isolado disponível. Por
isso, os testes remotos ficam desabilitados e não devem receber credenciais do
MVP. Quando houver um projeto de QA separado e dados sintéticos, habilitar
explicitamente com:

```powershell
$env:PHASE_1_QA_ENVIRONMENT = "isolated"
$env:PHASE_1_QA_BASE_URL = "https://qa.example.invalid"
$env:PHASE_1_QA_BEARER_TOKEN = "<jwt-de-usuario-admin-sintetico>"
$env:PHASE_1_QA_FULL_SCENARIOS = "1"
npm test -- tests/phase-1/phase-1-remote.integration.test.ts
```

O harness rejeita configuração sem o marcador `isolated` e rejeita URL igual
a `NEXT_PUBLIC_APP_URL` ou `NEXT_PUBLIC_SUPABASE_URL`. Nunca use
`SUPABASE_SECRET_KEY`, service role ou credenciais de produção como bearer
token. Os cenários completos deixam apenas dados sintéticos reversíveis no
ambiente; não existe limpeza destrutiva automática.

Para validar RLS entre organizações, fornecer também dois usuários normais e
organizações distintas:

```powershell
$env:PHASE_1_QA_BEARER_TOKEN_B = "<jwt-da-organizacao-b>"
$env:PHASE_1_QA_ORGANIZATION_ID = "<org-a>"
$env:PHASE_1_QA_ORGANIZATION_ID_B = "<org-b>"
```

Para a inspeção opcional de Storage privado, fornecer somente a chave
publishable do projeto QA (nunca service role):

```powershell
$env:PHASE_1_QA_SUPABASE_URL = "https://qa-project.supabase.co"
$env:PHASE_1_QA_PUBLISHABLE_KEY = "<publishable-key>"
```

Sem esse projeto isolado, os gates de concorrência real, RLS com identidades
distintas, Storage/RPC rollback, cleanup real e idempotência sob corrida
permanecem **ADIADOS**. A passagem da suíte local não constitui aprovação
remota; a migration já aplicada no MVP foi uma decisão operacional explícita e
não substitui essas provas.

Em especial, continuam adiados até existir esse ambiente: verificar com
usuários reais que uma URL/objeto de staging é negado antes e depois do commit,
que o job remove objetos órfãos no bucket privado, e que RLS impede download,
referência e mutação cruzada entre organizações. Os testes locais abaixo só
verificam que os contratos necessários estão presentes; não substituem essas
provas remotas.
