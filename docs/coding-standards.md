# Clean code e fronteiras

## Objetivo

Deixar cada mudanca pequena, localizavel, testavel e segura para um sistema que emite evidencia operacional. Clareza vence abstracao precoce.

## Regras

- Dar nome pelo dominio e intencao: `finalizeCollection`, `CollectionStatus`, `createPrivateDocumentUrl`; evitar `handleData`, `utils` ou `manager` genericos.
- Uma funcao faz uma tarefa coerente; extrair apenas quando a separacao aumenta compreensao ou reuso real.
- Componentes apresentam interface; regra de negocio e acesso a dados ficam em modulos apropriados, nao em JSX ou rota do Next.
- Nao duplicar validacao de seguranca em lugares que possam divergir. Compartilhar schema/guard no dominio ou manter a fonte primaria no servidor conforme a fronteira.
- Preferir retorno explicito ou uniao de resultado para erros esperados; excecoes sao para falhas inesperadas e devem preservar causa sem vazar detalhes ao usuario.
- Manter efeitos externos em adaptadores claros: banco, Storage, e-mail, PDF e APIs. Funcoes puras de regra de negocio devem ser simples de testar.
- Evitar booleans ambiguos em assinaturas; usar objeto nomeado ou uniao discriminada quando houver multiplos modos.
- Sem "generic repository" ou camada abstrata sem necessidade demonstrada. Consultas e comandos devem refletir o caso de uso.

## Fronteiras obrigatorias

| Fronteira | Regra |
| --- | --- |
| Rota Next → FSD | Rota fina reexporta/delega; nao concentra negocio |
| UI / Action / `route.ts` → dados | **DAL unica** (`queries.ts` / `commands.ts` + auth). Proibido `fetch` interno da `/api` e query no JSX. ADR 0009 |
| Server → Client | Somente DTO serializavel e minimo necessario |
| Cliente → servidor | Entrada nao confiavel; validar em runtime |
| Aplicacao → Supabase | RLS e autorizacao por comando; sem client admin no navegador |
| Coleta → documento | Usar snapshot versionado, nunca dados mutaveis atuais |
| Dominio → integracao | Adaptador com contrato estreito e falha tratada |

## Comentarios e ADRs

Comentar o porquê de uma decisao incomum, nao repetir o codigo. Criar ADR em `docs/decisions/` para escolha que altera arquitetura, seguranca, integracao ou regra de imutabilidade. Uma ADR contem contexto, decisao, consequencias e status.

## Dependencias

Adicionar pacote somente com justificativa, licenca compativel, manutencao ativa e impacto no bundle/seguranca avaliados. Preferir API nativa para necessidades simples. Versoes ficam travadas pelo lockfile; CI usa instalacao limpa e auditoria sem `audit fix --force`.
