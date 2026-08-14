# Seguranca, privacidade e evidencias

## Principios obrigatorios

- Minimo privilegio: cada papel le e altera somente o necessario.
- Defesa em camadas: autorizacao na aplicacao, RLS no banco e politicas no Storage.
- Arquivos de evidencia privados por padrao.
- Auditoria de fatos relevantes sem edicao pelo usuario comum.
- Nao registrar CPF, telefone, assinatura, tokens ou URLs assinadas em logs de aplicacao.

## Perfil inicial do MVP

Na Fase 0 existira somente um administrador, provisionado manualmente. Convites, outros papeis e gestao de usuarios nao fazem parte do MVP inicial; a tabela abaixo e a matriz para quando a expansao for aprovada.

## Matriz futura de papeis

| Papel | Acesso |
| --- | --- |
| Administrador | Usuarios, configuracoes, todas as coletas e auditoria |
| Escritorio | Clientes, coletas, documentos e acompanhamento |
| Coletor | Criar e acompanhar suas coletas; nao administrar usuarios |
| Oficina | Ler coletas e movimentar estados de oficina autorizados |
| Financeiro | Consultar e registrar referencia fiscal; sem apagar historico |
| Consulta | Leitura limitada, sem dados sensiveis desnecessarios |

## Assinatura e prova documental

A assinatura desenhada e evidencia, nao apenas uma imagem. A finalizacao deve registrar nome declarado pelo signatario, declaracao de aceite, data/hora, coletor, sessao, documento congelado e hash. Endereco IP e dados de dispositivo so devem ser guardados se forem justificados na politica de privacidade e protegidos como dado pessoal.

Para uma guia comercial, este conjunto fortalece a prova operacional. Se um contrato exigir identificacao mais forte, sera avaliada integracao com assinatura eletronica avancada ou qualificada. A guia nao e substituta de NF-e.

## QR e links de consulta

- QR publico: inicialmente apenas validade, codigo, data, estado e identificacao minima da MJT; dados mascarados so entram se houver necessidade comprovada.
- Documento completo: somente usuario autenticado ou link privado de alta entropia, revogavel e com prazo quando aplicavel.
- Nunca usar codigo sequencial sozinho como autorizacao para abrir uma guia.

## Medidas tecnicas

- RLS habilitado em toda tabela exposta.
- Politicas distintas para leitura, insercao, atualizacao e exclusao de objetos no Storage.
- Links temporarios para download de PDF, fotos e assinatura.
- MFA fica adiado no MVP de administrador unico. Ele sera requisito antes de ampliar usuarios ou autorizar a operacao real com dados de coleta.
- Segredos somente em variaveis de ambiente do servidor/deploy.
- Cabecalhos de seguranca, protecao CSRF onde aplicavel, rate limit em login e verificacao QR.
- Monitoramento de erros, logs estruturados e alertas de falhas documentais.

## LGPD e operacao

A MJT sera controladora dos dados de clientes e responsaveis; provedores como hospedagem, banco e e-mail atuam conforme seus contratos. Antes do uso real, publicar politica de privacidade simples, definir canal para titulares, documentar finalidade e mapear quais operadores recebem dados.

Aplicar o minimo necessario: CPF/CNPJ e contato somente quando necessarios ao vinculo comercial; nao exigir geolocalizacao ou foto sem finalidade operacional clara.

## Backup e incidente

- Backup testavel do banco, com restauracao periodica em ambiente isolado.
- Copia separada de PDFs, fotos e assinaturas; backup do banco nao basta para objetos do Storage.
- Procedimento de incidente: conter acesso, registrar impacto, preservar evidencias, avaliar comunicacao e corrigir a causa.
