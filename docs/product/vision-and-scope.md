# Visao de produto e escopo

## Problema que o sistema resolve

A MJT precisa substituir o talao fisico por uma guia rastreavel de coleta. O foco primario do aplicativo e registrar a retirada dos itens pela MJT no local do cliente, com evidencia de quem os apresentou, quais itens foram coletados e qual foi o aceite. Hoje esse vinculo depende de papel e memoria operacional.

O Sistema de Coleta MJT sera a fonte de verdade da retirada. Cada coleta tera codigo unico, itens registrados, responsavel no local da coleta identificado, evidencia de aceite, documento PDF e historico de andamento.

### Glossario operacional

- **Coleta:** retirada fisica dos itens pela MJT no local informado.
- **Coletor/administrador MJT:** no MVP, e a unica usuaria do sistema: vai ao cliente, registra a coleta e leva os itens para a oficina propria da MJT.
- **Responsavel no local da coleta:** pessoa que apresenta e entrega os itens ao coletor da MJT.
- **Signatario:** pessoa que confirma os dados e registra o aceite. Por padrao, e a mesma pessoa responsavel no local; o fluxo pode permitir outra pessoa quando necessario.
- **Entrada na oficina:** registro interno da chegada dos itens na oficina propria da MJT. Nao representa entrega a uma oficina terceirizada.
- **Entrega ao cliente:** etapa posterior do ciclo operacional, depois da oficina e/ou faturamento; nao e o objetivo primario da tela de nova coleta.

## Usuario e contexto

| Papel | Necessidade principal |
| --- | --- |
| Administrador/coletor MJT | Registrar a coleta no cliente e acompanhar o item ate a oficina propria |
| Escritorio | Localizar guias, clientes e pendencias sem depender do talao |
| Oficina propria da MJT | Marcar a entrada e a evolucao do reparo |
| Financeiro | Relacionar a coleta com a NF-e emitida |
| Gestor | Auditar o historico e acompanhar operacao |
| Cliente | Receber o comprovante e conferir sua autenticidade |

## Resultado esperado para o cliente

Ao finalizar a coleta, o responsavel no local da coleta recebe uma guia com codigo MJT, data, itens, assinatura e QR Code. Ele pode guarda-la e verificar que o documento foi emitido pela MJT. A equipe consegue consultar o mesmo registro no escritorio ou na oficina propria da MJT.

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

1. O sistema sera uma PWA responsiva, mobile-first e com experiencia completa para desktop; nao sera um aplicativo nativo nesta etapa.
2. O codigo visivel tera formato `MJT-AAAA-NNNNNN`, com seis digitos sequenciais por ano.
3. O numero oficial nasce somente na finalizacao no servidor. Rascunhos usam identificador interno e nao sao documentos oficiais.
4. Uma coleta finalizada pode ser cancelada, mas nunca excluida. Correcao posterior gera evento e, quando afetar a guia, nova versao documental.
5. PDF emitido e evidencia associada sao congelados. Alterar dados cadastrais no futuro nao muda documentos anteriores.
6. QR Code publico verifica autenticidade sem expor dados pessoais completos.
7. Compartilhamento inicial e manual, usando o compartilhador nativo do aparelho para WhatsApp e um provedor para e-mail.
8. O cadastro do responsavel no local da coleta e do signatario parte da mesma pessoa por padrao, com possibilidade de separar os papeis quando a operacao exigir.
9. No cadastro do cliente, nome/razao, CPF/CNPJ e telefone sao obrigatorios; o endereco cadastral e opcional. O local da coleta continua obrigatorio em cada guia.
10. Os estados visiveis para a operacao usam "Em reparo" e "Pronto"; a nomenclatura interna deve permanecer consistente com esses significados.
11. O custo do reparo aparece nas telas internas de orcamento, detalhe e acompanhamento depois que a oficina propria registrar o valor. Ele nao pertence ao formulario inicial de nova coleta.
12. No MVP, a mesma administradora registra a coleta no cliente, a entrada na oficina propria, o orcamento, a aprovacao ou recusa e as etapas posteriores. Nao existem contas separadas para coletor, oficina ou cliente.
13. A MJT possui uma oficina propria fixa. Os locais de coleta variam por cliente e sao registrados em cada guia; a oficina de destino vem das configuracoes institucionais.
14. Uma coleta cancelada pode ser reaberta pela administradora. A reabertura preserva o motivo e o evento de cancelamento, reativa o mesmo registro e nao reutiliza nem cria outro numero oficial.
15. A entrada na oficina exige a conferencia e o registro dos itens coletados, alem da assinatura da administradora responsavel com nome e CNPJ.
16. A entrega ao cliente sera feita por um termo digital com os itens que estiverem prontos. O cliente confere os itens e assina com nome e CNPJ; entregas parciais sao permitidas e os itens restantes continuam no fluxo operacional.
17. O design e os prototipos usarao placeholders institucionais claramente identificados para logo, razao social, CNPJ, endereco, telefone e texto juridico. Os dados legitimos serao preenchidos posteriormente, antes da publicacao operacional e da emissao de documentos reais.

## Indicadores iniciais

- Coletas finalizadas por periodo e por coletor.
- Tempo entre coleta, entrada na oficina, faturamento e entrega ao cliente.
- Percentual de guias enviadas ao cliente.
- Pendencias por estado operacional.
- Falhas de sincronizacao e de geracao documental.
