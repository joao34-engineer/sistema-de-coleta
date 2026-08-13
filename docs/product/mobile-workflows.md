# Fluxos mobile e telas

## Principio de experiencia

O coletor deve concluir uma guia com uma mao, em poucos minutos e com pouca digitacao. A tela mostra sempre o progresso, salva rascunho automaticamente e nunca faz o usuario perder itens ou assinatura por uma falha de rede.

## Nova coleta

1. Abrir o atalho PWA e tocar em **Nova coleta**.
2. Buscar cliente por nome, CPF/CNPJ ou telefone; criar um novo se necessario.
3. Confirmar local, responsavel e contato.
4. Informar veiculo/placa e observacoes, quando existirem.
5. Adicionar itens: quantidade, descricao, condicao e observacao.
6. Anexar fotos, se houver avaria, identificacao ou exigencia do cliente.
7. Revisar o resumo com o responsavel.
8. Registrar nome, aceite e assinatura.
9. Finalizar; o sistema sincroniza, atribui numero e cria a guia.
10. Compartilhar pelo WhatsApp/e-mail ou encerrar.

## Regras de interface

- Campos obrigatorios claramente marcados e validados antes da assinatura.
- Botoes de acao principais fixos no rodape, com area de toque ampla.
- Itens em lista editavel, sem limite artificial e com remocao confirmada.
- Assinatura em area grande, com limpar/refazer antes da confirmacao.
- Estado de conexao e quantidade de rascunhos pendentes sempre visiveis.
- Apos finalizacao, bloquear alteracao silenciosa do conteudo e mostrar o PDF/compartilhamento.

## Consulta interna

A busca deve aceitar codigo exato, parte do codigo, cliente, CPF/CNPJ, telefone, status e periodo. A tela de detalhe mostra cabecalho, itens, fotos, documentos, NF-e vinculada e timeline.

## Verificacao por QR

O QR abre uma pagina leve, sem login, que confirma se a guia e autentica ou cancelada. Ela nao exibe telefone, documento integral, assinatura, fotos ou detalhes que possam expor o cliente.

## Acessibilidade e resiliencia

- Contraste legivel sob luz externa.
- Textos de erro diretos e em portugues.
- Navegacao por teclado em escritorio e etiquetas acessiveis em botoes.
- Indicacao explicita de "salvo localmente" e "sincronizado".
- Confirmacao antes de descartar rascunho ou cancelar uma guia.
