# Fase 1 — Coleta principal

## Objetivo

Permitir que a administradora/coletora da MJT crie, finalize e consulte uma coleta completa com garantia de integridade.

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
