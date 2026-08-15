# ADR 0003 - Contrato do nucleo tecnico da Fase 1A

## Status

Aceito em implementacao.

## Decisao

A Fase 1A entrega somente o nucleo tecnico: schema, RLS, Storage, comandos, APIs e testes. Nenhuma tela, componente, layout, template PDF ou pagina publica sera criada neste ciclo.

Clientes e signatarios aceitam CPF ou CNPJ normalizados para digitos. O endereco cadastral do cliente e opcional; o local da coleta e obrigatorio para finalizar. A coleta usa os estados persistidos `draft`, `collected` e `canceled`; reabertura e evento auditado que restaura o estado anterior e mantem o codigo oficial.

Finalizacao, cancelamento e reabertura sao comandos idempotentes. A finalizacao cria o codigo `MJT-AAAA-NNNNNN`, reserva a sequencia por organizacao/ano no fuso `America/Sao_Paulo`, congela o snapshot, calcula hash e cria uma versao documental com estado `snapshot_ready`. PDF renderizado, template e pagina QR ficam para ciclo posterior.

## Consequencias

- O banco e a API ficam prontos para uma interface futura sem decidir layout agora.
- O QR usa token aleatorio de alta entropia e somente retorna autenticidade, codigo, data, estado, organizacao e versao.
- A implementacao de comandos transacionais pode usar `SECURITY DEFINER` apenas com autorizacao interna, `search_path = ''`, schemas qualificados, `REVOKE` de `PUBLIC` e `GRANT` minimo para `authenticated`.
- Nenhum agente aplica migration no Supabase remoto; a aplicacao continua manual apos dry-run e revisao.
