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
2. Definir os campos obrigatorios e opcionais de cliente, responsavel, endereco, veiculo, item, observacao e evidencia da coleta.
3. Definir estados de rascunho, coleta finalizada, cancelada e em operacao, incluindo o que pode ou nao ser alterado em cada estado.
4. Definir textos de aceite, regras de assinatura, criterio para foto opcional e mensagens de erro/confirmacao.
5. Definir quais dados podem aparecer no QR publico e quais permanecem privados.

## Entregaveis para o Figma

1. Mapa de navegacao do administrador unico: login, inicio, nova coleta, busca, detalhe, configuracoes institucionais e verificacao publica por QR.
2. Fluxo ponta a ponta da coleta: localizar/criar cliente, informar local e responsavel, adicionar itens, revisar, assinar, finalizar, visualizar guia e compartilhar manualmente.
3. Lista de telas e estados obrigatorios: carregando, vazio, erro validavel, sem permissao, confirmacao de descarte, finalizacao bem-sucedida e coleta cancelada.
4. Inventario de componentes reutilizaveis: botoes, campos, seletores, cartoes, lista de itens, barra inferior de acao, status, dialogo de confirmacao, area de assinatura e notificacoes.
5. Tokens de design: cores semanticas, tipografia, espacamento, raio, elevacao, tamanhos de toque e comportamento responsivo. Usar identidade provisoria MJT ate a marca oficial ser fornecida.
6. Protótipo navegavel mobile-first e adaptacao desktop para escritorio. O fluxo deve demonstrar a jornada feliz e pelo menos uma falha de validacao por etapa critica.

## Limites de escopo

- O design pode mostrar a futura coleta, mas nao inclui fila offline, sincronizacao, equipe, convites, NF-e, WhatsApp API ou oficina.
- O designer nao deve inventar dados juridicos, regras de negocio, campos ou permissões; qualquer lacuna volta para este documento antes de ser desenhada.
- O QR de verificacao nao recebe dados pessoais, assinatura, foto ou documento integral.

## Criterios de aceite

- Cada tela no Figma aponta para o fluxo e requisito que atende.
- A jornada de coleta pode ser percorrida por uma pessoa sem depender de interpretacao verbal.
- Campos obrigatorios, validacoes, estados de erro e acoes irreversiveis estao identificados.
- Componentes repetidos usam variantes e tokens, nao copias independentes.
- O responsavel da MJT aprova o prototipo antes do inicio da Fase 1.
