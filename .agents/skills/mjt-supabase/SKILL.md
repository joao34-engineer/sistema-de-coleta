---
name: mjt-supabase
description: Governar mudanças de Supabase do Sistema de Coleta MJT, incluindo PostgreSQL, migrations, tipos gerados, Supabase Auth, RLS, Storage privado e credenciais server-only. Use ao criar ou alterar tabelas, policies, buckets, uploads, usuários, permissões, clientes Supabase ou operações que leem/escrevem evidências e documentos.
---

# MJT Supabase

Aplicar o contrato local sem expor dados de coleta, assinatura ou documentos.

## Leitura obrigatoria

Ler primeiro `../../../docs/supabase.md`, `../../../docs/security.md` e `../../../docs/architecture/data-and-rules.md`. Para estrutura de codigo, ler tambem `../../../docs/architecture/fsd.md`.

## Procedimento

1. Identificar a entidade, ator, operacao e dado pessoal afetado.
2. Inspecionar schema, migrations e policies existentes; nunca presumir o estado de producao.
3. Projetar migration aditiva e reversivel de forma segura. Proibir reset, drop ou exclusao de historico/documento.
4. Criar/revisar RLS, grants e politica de Storage na mesma mudanca. Comecar negando e liberar somente o minimo necessario.
5. Manter o client publishable condicionado a RLS; manter chave secret/service role em modulo `server-only`, fora de exports client.
6. Validar entrada, autorizacao de negocio e idempotencia no comando de servidor; RLS e camada adicional obrigatoria.
7. Gerar/revisar tipos do banco e mapear para DTOs. Nunca retornar linha ou `select('*')` por conveniencia.
8. Testar usuario autorizado, autenticado sem permissao e anonimo; testar tambem leitura de objeto privado e upload invalido.
9. Atualizar documento tematico ou ADR quando contrato, policy ou ambiente mudar.

## Regras essenciais

- `organization_id` participa do isolamento e das policies.
- `SECURITY INVOKER` e o padrao para RPC; `SECURITY DEFINER` requer justificativa, grants minimos e `search_path` explicito.
- Caminho de Storage usa UUID interno; validar tamanho e tipo antes do upload; download usa URL temporaria autorizada.
- Falta de env sensivel falha fechada. Nunca criar fallback de segredo.
- Backup de banco e de Storage sao responsabilidades distintas.

## Referencia

Use [checklist Supabase](references/supabase-checklist.md) na revisao final.
