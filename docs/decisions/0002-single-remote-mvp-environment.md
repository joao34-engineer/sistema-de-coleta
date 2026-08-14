# ADR 0002 - Ambiente remoto unico do MVP

## Status

Aceita.

## Contexto

O Sistema de Coleta MJT inicia como MVP familiar, para um unico administrador e poucas pessoas de confianca testarem o aplicativo. Nao ha orcamento ou necessidade atual de multiplos projetos Supabase, SMTP profissional ou plano de hospedagem pago.

O Supabase local em Docker foi avaliado, mas sua operacao no ambiente Windows adicionou instabilidade e manutencao que nao trazem beneficio proporcional ao MVP. A decisao e adiar esse ambiente local, sem descartar sua adocao futura caso o produto, a equipe ou a estrategia de testes passem a exigir isolamento adicional.

### Registro diagnostico para retomada futura

O Docker Desktop foi validado com containers Linux, 8 GB de memoria e 4 CPUs; ele nao foi identificado como indisponivel ou reiniciando. A CLI Supabase `2.114.0` tambem estava atualizada. Mesmo assim, `supabase start` e `supabase db start` encerraram com falha apos a inicializacao parcial da stack.

Ha duas configuracoes inadequadas ao escopo e ao Windows que devem ser reavaliadas antes de reativar o ambiente local: `analytics.enabled = true` e `storage.vector.enabled = true`. Analytics local no Windows exige que o daemon Docker seja exposto em `tcp://localhost:2375`, porta que nao estava disponivel. Vector Storage e um recurso alpha, nao previsto no produto e adiciona um servico extra. Realtime nao foi apontado como causa: ele chegou a completar suas migrations internas em uma tentativa posterior.

Esses fatos tornam Analytics/Vector a hipotese tecnica principal, mas nao uma causa definitiva: `supabase db start` tambem falhou e a CLI removeu os containers antes da captura do log final do Postgres. Para retomar a investigacao, primeiro registrar os eventos e logs do container Postgres antes da limpeza automatica; depois usar um perfil local deliberado, com Realtime mantido e somente servicos realmente necessarios habilitados. Nao retomar por repeticao cega de `supabase start`.

## Decisao

- Usar um unico projeto Supabase remoto, separado de qualquer projeto Shopee, para desenvolvimento integrado, validacao controlada e publicacao do MVP.
- Usar um unico deploy Vercel para a aplicacao. Nao criar staging remoto nem Supabase local nesta etapa.
- Manter migrations SQL versionadas no Git. Cada mudanca de schema sera aditiva, revisada, submetida a `supabase db push --dry-run` e aplicada manualmente ao projeto remoto; comandos de reset, drop ou limpeza nunca serao usados nesse projeto.
- Manter previews sem segredos e sem conexao ao banco remoto.
- Provisionar manualmente apenas um administrador. Convites, usuarios adicionais, recuperacao por e-mail e SMTP transacional ficam adiados.
- Tratar o ambiente remoto como validacao controlada, usando dados sinteticos. Coletas reais, documentos e evidencias insubstituiveis somente serao autorizados apos a Fase 4 comprovar backup/restauracao e procedimento operacional.

## Consequencias

Ha menos custo e menos operacao, mas nao existe isolamento de banco antes da publicacao. Portanto, cada mudanca que alcance o Supabase remoto exige revisao do SQL, validacao de tipos, lint, testes que nao dependam de banco local, `db push --dry-run`, migration aditiva e verificacao manual com dados sinteticos. O projeto remoto nao sera tratado como descartavel nem sera resetado.

Quando houver mais usuarios, dados reais recorrentes, necessidade de disponibilidade/recuperacao ou risco que justifique maior isolamento, a MJT devera revisar este ADR e decidir por Supabase local, ambiente de staging remoto, plano de backup, dominio e SMTP apropriados.
