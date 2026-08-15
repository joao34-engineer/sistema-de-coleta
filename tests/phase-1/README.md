# QA adversarial — Fase 1A

Estes testes definem o contrato de seguranca e integridade da Fase 1A sem
acessar o Supabase remoto por padrao.

## Testes locais

`phase-1-schema-contract.test.ts` passa a validar a migration aditiva da Fase
1 assim que ela existir. Enquanto o agente de banco ainda nao a entregou, o
arquivo e ignorado intencionalmente para manter a fundacao verde.

## Testes remotos opt-in

`phase-1-api-contract.test.ts` so executa quando estas variaveis forem
fornecidas explicitamente:

- `PHASE_1_QA_BASE_URL`: URL do ambiente controlado (sem barra final).
- `PHASE_1_QA_BEARER_TOKEN`: token de um administrador sintetico autorizado.

Os testes geram identificadores UUID novos por execucao e nao usam reset,
truncamento ou exclusao. Eles podem deixar rascunhos sinteticos no ambiente;
nao aponte essas variaveis para ambiente com dados reais. Os cenarios de RLS
com usuarios distintos continuam pendentes ate existirem duas identidades
sinteticas com papeis definidos para a Fase 1.
