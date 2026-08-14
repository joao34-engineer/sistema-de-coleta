# Fase 2 — Documento, QR e compartilhamento

## Objetivo

Transformar uma coleta finalizada em comprovante profissional, verificavel e compartilhavel.

## Passos

1. Definir template da Guia/Recibo de Coleta MJT a partir das configuracoes da empresa, usando placeholders institucionais ate os dados legitimos serem fornecidos.
2. Criar servico no servidor que renderiza PDF a partir do snapshot imutavel.
3. Inserir codigo, itens, dados de coleta, responsavel, assinatura, declaracao e identificador de versao.
4. Criar hash do documento e gravar o PDF em Storage privado.
5. Gerar QR Code para rota publica de verificacao com token nao enumeravel.
6. Criar pagina publica que informa autenticidade, data, codigo, estado e campos mascarados.
7. Criar link seguro para acesso ao PDF por usuario autenticado ou destinatario autorizado.
8. Implementar compartilhamento nativo do aparelho e envio de e-mail.
9. Registrar tentativa, canal, destinatario mascarado, resultado e horario de envio.
10. Criar revisao documental para correcao excepcional, preservando versao anterior.

## Regras de conteudo

- O PDF deve declarar que e guia de coleta e nao documento fiscal.
- O QR nao revela assinatura, telefone, CPF/CNPJ completo, fotos ou lista integral de itens.
- O logo e os dados institucionais devem ser os do snapshot de emissao.
- Nenhum documento real deve ser emitido com placeholders; antes da operacao, substituir e validar logo, razao social, CNPJ, endereco, telefone e texto juridico.
- Documento cancelado permanece verificavel como cancelado.

## Criterios de aceite

- Cada coleta finalizada gera um PDF consistente e recuperavel.
- O QR de uma guia valida confirma sua autenticidade; QR invalido ou cancelado e distinguivel.
- Compartilhar novamente nao gera novo codigo nem modifica a guia.
- Alterar telefone ou logo da empresa nao muda PDFs ja emitidos.
