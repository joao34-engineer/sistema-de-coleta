# Modelo de dados e regras de negocio

## Entidades

| Entidade | Conteudo e regra |
| --- | --- |
| `organizations` | Empresa dona dos dados; manter desde o inicio para isolamento futuro |
| `profiles` e `roles` | Usuario autenticado, funcao e permissao operacional |
| `customers` | Pessoa fisica ou juridica, nome/razao, CPF/CNPJ e situacao |
| `customer_contacts` | Responsaveis, telefone, e-mail e cargo; nao duplicar em cada coleta |
| `customer_addresses` | Enderecos e indicacao de principal |
| `vehicles` | Veiculo e placa opcionais vinculados ao cliente |
| `collections` | Cabecalho, codigo oficial, estado, snapshots e metadados |
| `collection_items` | Descricao, quantidade, condicao e observacoes de cada item |
| `evidences` | Fotos e outros anexos, em Storage privado |
| `signatures` | Signatario, aceite, arquivo e dados de evidencia |
| `documents` | Snapshot, PDF, hash, versao e data de emissao |
| `collection_events` | Timeline append-only de fatos relevantes |
| `share_deliveries` | Tentativas de e-mail/compartilhamento e resultado |
| `service_orders` | Fase posterior: ordem de servico da oficina propria da MJT vinculada a coleta, com orcamento e custo do reparo |
| `invoice_references` | Numero, serie e data de NF-e informados pela equipe |

## Regras do codigo oficial

1. Cada coleta possui UUID interno desde o rascunho.
2. Na transacao de finalizacao, o banco reserva o proximo sequencial da organizacao e do ano de emissao.
3. O servidor monta `MJT-AAAA-NNNNNN` e o grava com restricao de unicidade.
4. Uma tentativa repetida de finalizacao retorna o mesmo resultado; ela nao cria outro numero.
5. Numero cancelado nao volta para a sequencia. Lacunas documentadas sao preferiveis a reutilizacao.
6. O ano do codigo e o da emissao pelo servidor; a data real de coleta permanece registrada separadamente.

## Estados e transicoes

```text
rascunho -> pendente_sincronizacao -> coletada -> em_oficina
em_oficina -> em_orcamento -> aguardando_aprovacao
aguardando_aprovacao -> aprovada -> em_reparo -> pronto
pronto -> entregue
pronto -> faturada -> entregue (NF-e opcional; nao bloqueia a entrega)
faturada ou pronto ou em_reparo -> entrega_parcial -> entregue (quando existirem itens prontos e itens pendentes)
em_orcamento ou aguardando_aprovacao -> nao_aprovada
coletada, em_oficina ou estados posteriores -> cancelada (com motivo)
cancelada -> reaberta -> retorno ao estado operacional anterior (com motivo e auditoria)
```

Somente usuarios autorizados podem executar uma transicao. Todo evento guarda ator, horario, estado anterior, estado novo e motivo quando exigido. O dwell de espera pela aprovacao do orcamento e `em_orcamento` (`in_budget`); `aguardando_aprovacao` (`awaiting_approval`) permanece no CHECK e nos contratos como reserva defensiva, mas nenhuma RPC o grava hoje.

## Finalizacao e documento

Para finalizar e emitir uma guia, sao obrigatorios:

- cliente identificado com nome/razao, CPF/CNPJ e telefone;
- endereco/local da coleta;
- ao menos um item com descricao e quantidade positiva;
- responsavel no local da coleta identificado;
- coletor autenticado;
- aceite e assinatura do signatario; por padrao, o signatario e o responsavel no local da coleta, mas podem ser pessoas diferentes quando necessario;
- data/hora da coleta.

O endereco cadastral do cliente pode permanecer vazio; o endereco ou local especifico da coleta e obrigatorio na guia.

O custo do reparo pertence a etapa de oficina/orcamento, deve ser registrado em moeda BRL e permanecer no acesso interno autorizado. O valor nao e publicado na verificacao minima por QR.

No MVP, a oficina e a unidade propria da MJT. A entrada dos itens e um evento interno posterior a coleta; nao ha fluxo de transferencia para uma oficina de terceiro nem conta separada de usuario da oficina.

A entrada na oficina exige conferencia item a item, quantidade observada, condicao observada e registro de divergencia quando necessario. O evento deve guardar a assinatura da administradora responsavel com nome e CNPJ.

A entrega ao cliente cria um evento e uma versao documental com somente os itens que estiverem prontos e forem efetivamente entregues. O cliente confere os itens e assina com nome e CNPJ. Entregas parciais sao permitidas; a coleta so assume o estado final `entregue` quando nao restarem itens pendentes. A RPC de entrega aceita `em_reparo` (`in_service`), `pronta` (`ready`), `faturada` (`invoiced`) ou `entrega_parcial` (scan **5.6**, 06/09/2026, remoto + Production). Entrega mid-repair e permitida: so entra no termo o item cuja ordem de servico esta `pronto`; item que nao esta `pronto` e recusado com `item_not_ready`. Apos entrega parcial, o status da OS segue o restante (`delivered` se nao sobrou nada, `in_service` se o restante inclui `em_reparo`, `ready` se o restante esta todo `pronto`). `update_service_progress` tambem aceita coleta em `partial_delivery` e nao a puxa de volta para `ready`; recusa item ja presente em `delivery_items` com `item_already_delivered`. Registrar NF-e e opcional e nao e pre-requisito. **Decisao 07/09/2026 (fechada — nao perguntar):** NF-e continua disponivel em `partial_delivery`; `register_invoice_reference` deve aceitar `ready | partial_delivery`; coleta ja `invoiced` nao rebaixa para `partial_delivery` numa entrega posterior. O codigo ainda so aceita `ready` ate o leftover L2. A aprovacao do orcamento exige nome e CNPJ; o pad de assinatura desenhada fica **opcional** ate pedido explicito (scan **5.7**, 06/09/2026).

O servidor cria um snapshot completo, calcula hash de integridade e associa assinatura e PDF a essa versao. Dados mostrados no documento devem vir do snapshot, nao de consultas mutaveis de cliente ou itens.

## Correcao, cancelamento e retencao

- Rascunhos podem ser editados e descartados pelo proprio criador conforme permissao.
- Coletas finalizadas nao sao apagadas.
- Mudanca que altere o conteudo da guia exige uma revisao documentada; a guia original continua preservada.
- Cancelamento exige motivo, usuario e data; o QR passa a indicar cancelada.
- A administradora pode reabrir uma coleta cancelada quando o cancelamento tiver sido indevido ou precisar ser desfeito. A reabertura registra ator, data, motivo e estado anterior; o mesmo codigo oficial permanece vinculado a coleta e nenhum numero e reutilizado. Se ja existir guia emitida, a reabertura gera nova versao documental e preserva a versao que registrava o cancelamento.
- Prazos de retencao e anonimização serao definidos com a administracao e orientacao contabil/juridica, sem apagar evidencias exigidas para defesa de direitos ou obrigacoes legais.
