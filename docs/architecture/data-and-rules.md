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
| `service_orders` | Fase posterior: ordem de servico vinculada a coleta |
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
aguardando_aprovacao -> aprovada -> em_servico -> pronta
pronta -> faturada -> entregue
em_orcamento ou aguardando_aprovacao -> nao_aprovada
coletada, em_oficina ou estados posteriores -> cancelada (com motivo)
```

Somente usuarios autorizados podem executar uma transicao. Todo evento guarda ator, horario, estado anterior, estado novo e motivo quando exigido.

## Finalizacao e documento

Para finalizar e emitir uma guia, sao obrigatorios:

- cliente identificado;
- endereco/local da coleta;
- ao menos um item com descricao e quantidade positiva;
- responsavel pela entrega;
- coletor autenticado;
- aceite e assinatura do responsavel;
- data/hora da coleta.

O servidor cria um snapshot completo, calcula hash de integridade e associa assinatura e PDF a essa versao. Dados mostrados no documento devem vir do snapshot, nao de consultas mutaveis de cliente ou itens.

## Correcao, cancelamento e retencao

- Rascunhos podem ser editados e descartados pelo proprio criador conforme permissao.
- Coletas finalizadas nao sao apagadas.
- Mudanca que altere o conteudo da guia exige uma revisao documentada; a guia original continua preservada.
- Cancelamento exige motivo, usuario e data; o QR passa a indicar cancelada.
- Prazos de retencao e anonimização serao definidos com a administracao e orientacao contabil/juridica, sem apagar evidencias exigidas para defesa de direitos ou obrigacoes legais.
