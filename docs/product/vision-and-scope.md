# Visao de produto e escopo

## Problema que o sistema resolve

A MJT precisa substituir talao fisico por uma guia rastreavel de coleta. Hoje o vinculo entre o que foi retirado, o responsavel que entregou, o servico executado e a nota fiscal depende de papel e memoria operacional.

O Sistema de Coleta MJT sera a fonte de verdade da retirada. Cada coleta tera codigo unico, itens registrados, responsavel identificado, evidencia de aceite, documento PDF e historico de andamento.

## Usuario e contexto

| Papel | Necessidade principal |
| --- | --- |
| Coletor | Registrar uma coleta rapidamente no celular, inclusive com conexao instavel |
| Escritorio | Localizar guias, clientes e pendencias sem depender do talao |
| Oficina | Marcar a entrada e a evolucao do servico |
| Financeiro | Relacionar a coleta com a NF-e emitida |
| Gestor | Auditar o historico e acompanhar operacao |
| Cliente | Receber o comprovante e conferir sua autenticidade |

## Resultado esperado para o cliente

Ao finalizar a coleta, o responsavel recebe uma guia com codigo MJT, data, itens, assinatura e QR Code. Ele pode guarda-la e verificar que o documento foi emitido pela MJT. A equipe consegue consultar o mesmo registro no escritorio ou na oficina.

## Escopo de V1

- Autenticacao e usuarios com permissoes.
- Clientes, contatos, enderecos e veiculos opcionais.
- Coletas com itens de quantidade livre, observacoes e fotos opcionais.
- Assinatura do responsavel e identificacao do coletor.
- Numeracao sequencial oficial, PDF, QR Code e compartilhamento.
- Busca, filtros, detalhes e linha do tempo.
- Estados operacionais basicos e referencia manual a NF-e.
- PWA com rascunhos e fila de sincronizacao offline.

## Fora do escopo de V1

- Emissao ou transmissao de NF-e.
- WhatsApp Business API e mensagens automaticas.
- Controle de estoque, compras ou financeiro completo.
- Portal do cliente com login.
- Roteirizacao, GPS obrigatorio ou rastreamento de frota.
- Orcamento detalhado e controle de producao por tecnico.

Esses itens podem ser adicionados sem reescrever a coleta, desde que respeitem os contratos de dados definidos em `architecture/`.

## Decisoes de produto

1. O sistema sera uma PWA responsiva, nao um aplicativo nativo nesta etapa.
2. O codigo visivel tera formato `MJT-AAAA-NNNNNN`, com seis digitos sequenciais por ano.
3. O numero oficial nasce somente na finalizacao no servidor. Rascunhos usam identificador interno e nao sao documentos oficiais.
4. Uma coleta finalizada pode ser cancelada, mas nunca excluida. Correcao posterior gera evento e, quando afetar a guia, nova versao documental.
5. PDF emitido e evidencia associada sao congelados. Alterar dados cadastrais no futuro nao muda documentos anteriores.
6. QR Code publico verifica autenticidade sem expor dados pessoais completos.
7. Compartilhamento inicial e manual, usando o compartilhador nativo do aparelho para WhatsApp e um provedor para e-mail.

## Indicadores iniciais

- Coletas finalizadas por periodo e por coletor.
- Tempo entre coleta, entrada na oficina, faturamento e entrega.
- Percentual de guias enviadas ao cliente.
- Pendencias por estado operacional.
- Falhas de sincronizacao e de geracao documental.
