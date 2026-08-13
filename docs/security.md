# Seguranca, privacidade e evidencias

Este documento complementa a visao operacional em `security-and-compliance.md` e e leitura obrigatoria para qualquer alteracao de autenticacao, documento, QR, arquivo, API, dado pessoal ou integracao.

## Nivel de rigor

O sistema guarda identificacao de clientes, contatos, assinatura e documentos operacionais. Adotar OWASP ASVS nivel 2 como guia proporcional, com foco em autenticacao, controle de acesso, validacao, protecao de dados, arquivos, logging, logica de negocio e configuracao.

## Ameaças prioritarias

| Ameaça | Controle exigido |
| --- | --- |
| Usuario acessa coleta de outro papel/organizacao | RLS, autorizacao no comando e testes negativos |
| Documento ou QR enumeravel vaza dados | Token imprevisivel, dados mascarados, expiracao/revogacao |
| Upload malicioso ou excessivo | Allowlist de MIME/tamanho, caminho interno, bucket privado |
| Reenvio de finalizacao duplica guia | Chave de idempotencia e transacao no banco |
| Alteracao posterior invalida prova | Snapshot, hash, versao e eventos append-only |
| Secret no navegador ou log | `server-only`, env validada e redacao em logs |
| Abuso de login/QR/API | Rate limit, limites de payload e alertas |

## Regras de implementacao

- Validar toda entrada no limite do servidor, incluindo `FormData`, params, JSON, cabeçalhos e metadados de upload. TypeScript nao valida dados em runtime.
- Reautenticar e reautorizar toda Server Action, Route Handler e comando que le dados sensiveis ou muda estado.
- URLs externas, redirects e destinos de e-mail devem ser validados por protocolo e allowlist quando aplicavel; nunca buscar URL arbitraria enviada pelo cliente.
- Usar UUID interno para armazenamento e nomes de arquivo servidos seguros; nao montar path a partir de entrada do usuario.
- Comparar segredo de integracao com funcao de tempo constante quando houver token compartilhado.
- Nao usar cache publico para dados autenticados, links assinados, erros ou documentos.
- Logs registram evento, request id, usuario pseudonimizado e resultado; nunca payload pessoal integral, assinatura, PDF, CPF, telefone, token ou chave.

## Assinatura, PDF e QR

A assinatura desenhada e apenas parte da evidencia. Ao finalizar, congelar snapshot, signatario declarado, texto de aceite, data/hora do servidor, coletor, hash e identificador da versao. PDF e QR devem refletir essa versao.

QR de verificacao e publico somente para status de autenticidade, codigo, data e dados mascarados. Acesso ao documento completo exige sessao autorizada ou token privado de alta entropia, com possibilidade de revogacao. Uma guia cancelada continua verificavel como cancelada.

## Privacidade e LGPD

Coletar somente o necessario para a coleta e vinculo comercial, documentar finalidade e manter canal para titulares. Antes do lancamento, definir retencao, operador/fornecedor, responsavel por acessos e resposta a incidente. Exportacao, descarte ou anonimização nunca podem apagar evidencias mantidas por obrigacao legal ou defesa de direitos sem decisao formal.

## Review antes de producao

Revisar permissao por papel, migration/RLS, Storage, env, CSP/cabecalhos, rate limit, upload, logs, cache, backup/restore e cenario de usuario malicioso. OWASP ASVS e referencia de verificacao, nao uma checklist copiada sem contexto.

Fontes: [OWASP ASVS 5.0](https://owasp.org/www-project-application-security-verification-standard/), [ASVS para desenvolvedores](https://devguide.owasp.org/en/03-requirements/05-asvs/) e [seguranca de dados Next.js](https://nextjs.org/docs/app/guides/data-security).
