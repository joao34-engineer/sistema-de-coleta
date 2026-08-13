# ADR 0001 — Arquitetura inicial

## Status

Aceita em 2026-08-13.

## Contexto

O sistema precisa funcionar em celular e escritorio, registrar dados relacionais, proteger evidencias, produzir documentos e crescer de coleta para oficina sem complexidade operacional desnecessaria.

## Decisao

Usar Next.js com TypeScript e App Router como aplicacao PWA e camada de aplicacao. Usar Supabase com PostgreSQL, Auth, Storage privado e RLS. Publicar de forma independente, com projeto Supabase, dominio, ambientes e repositorio Git proprios.

## Consequencias

- Entrega rapida de uma aplicacao unica para Android, iPhone e computador.
- Banco relacional e arquivos gerenciados sem manter servidor proprio.
- Regras criticas devem permanecer no servidor e no banco; nao confiar em validacao de cliente.
- Integracoes complexas futuras poderao ser extraidas para adaptadores/servicos sem reescrever o nucleo.
