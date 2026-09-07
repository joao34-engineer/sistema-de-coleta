# Fluxos mobile e telas

## Principio de experiencia

O coletor deve concluir uma guia com uma mao, em poucos minutos e com pouca digitacao. A tela mostra sempre o progresso, salva rascunho automaticamente e nunca faz o usuario perder itens ou assinatura por uma falha de rede.

## Nova coleta

1. A administradora/coletora da MJT abre o atalho PWA e toca em **Nova coleta**.
2. Buscar cliente por nome, CPF/CNPJ ou telefone; criar um novo se necessario.
3. Confirmar local da coleta, responsavel no local e contato.
4. Informar veiculo/placa e observacoes, quando existirem.
5. Adicionar itens: quantidade, descricao, condicao e observacao.
6. Anexar fotos, se houver avaria, identificacao ou exigencia do cliente.
7. Revisar o resumo com o responsavel no local da coleta.
8. Registrar o nome, o aceite e a assinatura do signatario; por padrao, usar o responsavel no local, permitindo informar outra pessoa quando necessario.
9. Finalizar; o sistema sincroniza, atribui numero e abre Documentos. Enquanto o PDF nao existir, a tela mostra “Gerando o PDF da guia…”.
10. Depois do artefato: baixar, criar link seguro e compartilhar pelo WhatsApp (`/d/{token}`) ou encerrar.

## Entrada na oficina propria

Depois da retirada, a mesma administradora leva os itens para o endereco fixo da oficina propria da MJT e registra a entrada no sistema. O nome e o endereco da oficina vem das configuracoes institucionais; nao precisam ser digitados em cada coleta. Se outra pessoa estiver presente para receber os itens, o sistema registra o nome e a assinatura dela; se a administradora apenas der entrada nos itens, registra a chegada como evento interno. Esta etapa nao e uma entrega para oficina terceirizada.

A entrada exige a conferencia item a item. A administradora confirma quantidade e condicao observadas, registra divergencias quando existirem e assina o evento com nome e CNPJ.

## Entrega ao cliente

1. Abrir a coleta e selecionar somente os itens com status **Pronto**. Itens ainda em reparo permanecem visiveis na lista, nao selecionaveis, rotulados `Continua em reparo`; nao os ocultar — o operador precisa ve-los.
2. Gerar o termo digital de entrega com numero da coleta, itens prontos, quantidades e observacoes relevantes.
3. Permitir que o cliente confira os itens presencialmente.
4. Capturar assinatura do cliente com nome e CNPJ.
5. Registrar data, hora, administradora responsavel e itens efetivamente entregues.
6. Emitir a versao do documento e disponibilizar visualizar, baixar, imprimir e compartilhar.

Se apenas parte dos itens estiver pronta, a entrega parcial e permitida. Os itens restantes permanecem na coleta com o estado operacional correspondente; a coleta somente fica totalmente **Entregue** quando todos os itens forem entregues.

## Regras de interface

- Campos obrigatorios claramente marcados e validados antes da assinatura.
- Botoes de acao principais fixos no rodape, com area de toque ampla.
- Itens em lista editavel, sem limite artificial e com remocao confirmada.
- Assinatura em area grande, com limpar/refazer antes da confirmacao.
- Estado de conexao e quantidade de rascunhos pendentes sempre visiveis.
- Apos finalizacao, bloquear alteracao silenciosa do conteudo e ir para Documentos (pending honesto, depois PDF/compartilhamento).

## Consulta interna

A busca deve aceitar codigo exato, parte do codigo, cliente, CPF/CNPJ, telefone, status e periodo. A tela de detalhe mostra cabecalho, itens, fotos, documentos, NF-e vinculada e timeline.

O produto sera desenhado para dois contextos: coleta em celular, com uso rapido e uma mao, e escritorio em desktop, com tabelas, filtros, timeline e revisao de documentos. O desktop nao sera tratado como uma ampliacao simples da tela mobile.

## Verificacao por QR

O QR abre uma pagina leve, sem login, que confirma se a guia e autentica ou cancelada. Ela nao exibe telefone, documento integral, assinatura, fotos ou detalhes que possam expor o cliente.

## Acessibilidade e resiliencia

- Contraste legivel sob luz externa.
- Textos de erro diretos e em portugues.
- Navegacao por teclado em escritorio e etiquetas acessiveis em botoes.
- Indicacao explicita de "salvo localmente" e "sincronizado".
- Confirmacao antes de descartar rascunho ou cancelar uma guia.
