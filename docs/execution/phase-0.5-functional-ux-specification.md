# Fase 0.5 - Especificacao funcional e UX

## Objetivo

Transformar os requisitos da coleta em um contrato de produto claro antes de criar telas definitivas no Figma ou escrever a Fase 1. Esta fase nao implementa funcionalidades.

## Entradas obrigatorias

- `docs/product/vision-and-scope.md`
- `docs/product/mobile-workflows.md`
- `docs/architecture/data-and-rules.md`
- Decisoes de seguranca, imutabilidade e privacidade da documentacao.

## Decisoes que devem ser fechadas

1. Confirmar que o MVP inicial tem somente um administrador e login por e-mail e senha; convite, equipe, MFA e recuperacao por e-mail continuam fora do escopo.
2. Definir os campos obrigatorios e opcionais de cliente, responsavel no local da coleta, signatario, endereco, veiculo, item, observacao e evidencia da coleta. O endereco cadastral do cliente e opcional; a localizacao da coleta continua obrigatoria para finalizar uma guia.
3. Definir estados de rascunho, coleta finalizada, cancelada e em operacao, incluindo o que pode ou nao ser alterado em cada estado.
4. Definir textos de aceite, regras de assinatura, criterio para foto opcional e mensagens de erro/confirmacao.
5. Definir quais dados podem aparecer no QR publico e quais permanecem privados.

## Decisoes ja registradas

- O produto e principalmente um sistema de coleta: a retirada dos itens pela MJT e o centro da jornada.
- A unica usuaria operacional do MVP e a administradora/coletora da MJT: ela vai ao cliente, registra a retirada e leva os itens para a oficina propria da MJT. A oficina nao e um terceiro no fluxo.
- A entrada na oficina propria sera desenhada como evento operacional separado da coleta. Se outra pessoa receber os itens, ela assina; caso contrario, a administradora registra a chegada interna.
- O Figma cobrira celular e desktop, com mobile-first para o coletor e experiencia desktop completa para escritorio e operacao.
- A condicao do item sera inicialmente texto livre, sem uma lista fechada de categorias.
- Fotos de itens sao opcionais.
- O responsavel no local da coleta e o signatario por padrao; o fluxo permite separar as pessoas quando necessario.
- Nome/razao, CPF/CNPJ e telefone do cliente sao obrigatorios; o endereco cadastral do cliente e opcional.
- Os estados visiveis serao "Em reparo" e "Pronto", substituindo os rascunhos de nomenclatura "Em recuperacao" e "Concluido" do documento original.
- O custo do reparo sera apresentado nas telas internas de orcamento, detalhe e acompanhamento, depois que a oficina registrar o valor. A exibicao desse valor no documento entregue ao cliente ainda sera uma decisao especifica do fluxo documental.
- A identidade visual inicial usara um monograma MJT ate a logo oficial ser fornecida.
- A oficina de destino e uma unidade propria fixa da MJT; os locais de coleta variam por cliente e sao informados em cada guia.
- Uma coleta cancelada pode ser reaberta pela administradora, preservando o historico, o mesmo numero oficial e os motivos registrados.
- A entrada na oficina exige conferencia dos itens e assinatura obrigatoria da administradora com nome e CNPJ.
- A entrega ao cliente sera desenhada como termo digital: o cliente confere os itens prontos e assina com nome e CNPJ. O fluxo permite entrega parcial, mantendo os itens restantes pendentes ate a conclusao.
- O Figma usara placeholders para logo, razao social, CNPJ, endereco, telefone e texto juridico. Esses placeholders devem ser visualmente identificados e nao podem ser tratados como dados reais.

## Entregaveis para o Figma

1. Mapa de navegacao do administrador unico: login, inicio, nova coleta, busca, detalhe, configuracoes institucionais e verificacao publica por QR.
2. Fluxo ponta a ponta da coleta: localizar/criar cliente, informar local e responsavel, adicionar itens, revisar, assinar, finalizar, visualizar guia e compartilhar manualmente.
3. Lista de telas e estados obrigatorios: carregando, vazio, erro validavel, sem permissao, confirmacao de descarte, finalizacao bem-sucedida e coleta cancelada.
4. Inventario de componentes reutilizaveis: botoes, campos, seletores, cartoes, lista de itens, barra inferior de acao, status, dialogo de confirmacao, area de assinatura e notificacoes.
5. Tokens de design: cores semanticas, tipografia, espacamento, raio, elevacao, tamanhos de toque e comportamento responsivo. Usar identidade provisoria MJT ate a marca oficial ser fornecida.
6. Protótipo navegavel mobile-first e adaptacao desktop para escritorio. O fluxo deve demonstrar a jornada feliz e pelo menos uma falha de validacao por etapa critica.
7. Mapa completo das telas previstas para o ciclo operacional: coleta, oficina, aprovacao, servico, faturamento, entrega ao cliente, cancelamento, documentos, compartilhamento e verificacao por QR. O desenho completo nao antecipa a implementacao: cada modulo continuara sendo desenvolvido na fase correspondente.

## Entregaveis obrigatorios do design completo

Esta lista faz parte do escopo da Fase 0.5 e deve ser concluida no Figma antes do inicio da implementacao das funcionalidades correspondentes. Ela define o que precisa ser desenhado; nao significa que todas as funcionalidades serao codificadas nesta fase.

1. Inventario final de telas, rotas e variacoes por estado, incluindo coleta, entrada na oficina, orcamento, aprovacao, reparo, pronto, faturamento, entrega parcial ou total, cancelamento, reabertura, documentos, compartilhamento e verificacao por QR.
2. Textos de interface e mensagens de cada tela: titulos, instrucoes, labels, placeholders, validacoes, confirmacoes, sucesso, erro, cancelamento, reabertura e ausencia de dados.
3. Layout do orcamento, com diagnostico, servicos, pecas, mao de obra, desconto, total, observacoes, validade e estado de aprovacao.
4. Estados visuais de cada item: coletado, em oficina, em analise, aguardando aprovacao, em reparo, pronto, entregue, pendente, divergente e cancelado quando aplicavel.
5. Estados de sistema para cada fluxo: carregando, vazio, salvando, sincronizando, sucesso, erro recuperavel, erro inesperado, sem permissao, confirmacao de acao irreversivel e reabertura.
6. Organizacao responsiva para celular, tablet e desktop, incluindo navegacao, tabelas, filtros, formularios, barra de acoes e comportamento em orientacao estreita.
7. Tokens de design e biblioteca de componentes: cores semanticas, tipografia, espacamento, raios, bordas, sombras, icones, botoes, campos, tabelas, status, modais, notificacoes, assinatura e documentos.

Cada entregavel deve estar vinculado a uma tela, fluxo ou regra deste documento. Nenhum modulo futuro pode ser omitido do Figma por estar fora da fase de implementacao atual.

## Limites de escopo

- O Figma deve representar todos os estados e modulos previstos para a operacao, inclusive oficina, aprovacao, servico, faturamento, entrega ao cliente, documentos e QR. Isso e um contrato visual e funcional; a implementacao continuara faseada.
- Permanecem fora do escopo do produto aprovado: fila offline implementada nesta fase, equipe/convites, emissao de NF-e, WhatsApp Business API, controle de estoque, portal do cliente e roteirizacao.
- O designer nao deve inventar dados juridicos, regras de negocio, campos ou permissões; qualquer lacuna volta para este documento antes de ser desenhada.
- O QR de verificacao comecara com o minimo necessario: autenticidade/estado, codigo da guia, data e identificacao da MJT. Nao recebe CPF/CNPJ, telefone, endereco, itens, custo, assinatura, foto ou documento integral.
- Dados institucionais ausentes nao bloqueiam o prototipo: usar `{{LOGO_MJT}}`, `{{RAZAO_SOCIAL_MJT}}`, `{{CNPJ_MJT}}`, `{{ENDERECO_MJT}}`, `{{TELEFONE_MJT}}` e `{{TEXTO_JURIDICO_RECIBO}}` ate a substituicao autorizada.

## Criterios de aceite

- Cada tela no Figma aponta para o fluxo e requisito que atende.
- A jornada de coleta pode ser percorrida por uma pessoa sem depender de interpretacao verbal.
- Campos obrigatorios, validacoes, estados de erro e acoes irreversiveis estao identificados.
- Componentes repetidos usam variantes e tokens, nao copias independentes.
- O responsavel da MJT aprova o prototipo antes do inicio da Fase 1.
