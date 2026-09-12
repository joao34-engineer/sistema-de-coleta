# Sistema de Coleta MJT

Aplicação independente para registrar coletas, emitir guias digitais assinadas e acompanhar o ciclo operacional até a entrega.

## Estado atual

A fundação da Fase 0 está implementada e conectada a um único projeto Supabase remoto. O fluxo atual inclui login por e-mail e senha, dashboard, configurações institucionais, Storage privado para o logo, auditoria e PWA instalável por manifest.

Coletas, clientes, itens, assinaturas, documentos, QR e funcionamento offline ainda não estão habilitados. O ambiente remoto é uma produção técnica controlada do MVP e deve usar somente dados sintéticos até a liberação da Fase 4.

## Ambiente aprovado

- Windows para desenvolvimento.
- Next.js App Router, React, TypeScript estrito e Tailwind CSS.
- Supabase remoto único para Auth, PostgreSQL, Storage privado e RLS.
- Vercel: URL e publishable key no cliente; `SUPABASE_SECRET_KEY` somente no servidor (rate limit + worker de documentos). Nunca `NEXT_PUBLIC_*`, nunca no Git.
- Supabase local/Docker adiado; não executar `supabase start`, `supabase db reset` ou `supabase db reset --linked` neste fluxo.
- Um único administrador provisionado manualmente no painel Supabase.

## Desenvolvimento

Na pasta `sistema-coleta`:

```powershell
npm.cmd ci
npm.cmd run dev
```

O arquivo `.env.example` documenta as variáveis necessárias. Nunca versionar `.env.local`, chaves secretas ou senhas.

Validações:

```powershell
npm.cmd run architecture
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
npm.cmd run test:e2e
```

O `typecheck` executa `next typegen` antes do compilador. Os tipos de desenvolvimento gerados em `.next/dev` são ignorados pelo TypeScript devido a uma incompatibilidade conhecida da versão atual do Next; os tipos oficiais de `.next/types` continuam sendo verificados. Nunca editar arquivos gerados dentro de `.next`.

## Banco remoto

Migrations ficam em `supabase/migrations/` e são aditivas. Antes de aplicar uma mudança:

1. Revisar o SQL e o impacto.
2. Conferir o projeto remoto vinculado.
3. Executar `supabase db push --dry-run` quando a CLI estiver autenticada.
4. Aplicar somente a migration revisada.
5. Validar RLS, Storage, Auth e advisors.

O projeto remoto não deve receber reset, drop, limpeza de histórico ou dados reais nesta fase.

## Bootstrap do administrador

O usuário remoto é criado manualmente no painel Supabase. Depois, o script idempotente cria o vínculo administrativo:

```powershell
npm.cmd run bootstrap:admin
```

No modo remoto, a senha nunca é lida ou alterada pelo script. `SUPABASE_SECRET_KEY` é obrigatória no servidor Vercel (RPC de rate limit e worker de documentos); nunca `NEXT_PUBLIC_*`, nunca no cliente e nunca commitada. No bootstrap local ela fica só no terminal.

## Documentação e governança

Comece por [AGENTS.md](AGENTS.md) e [docs/README.md](docs/README.md). Os documentos de execução ficam abaixo de 500 linhas e devem ser seguidos na ordem indicada.

Não utilizar client administrativo do Supabase no navegador e não confiar somente na interface para autorização. A casca PWA (manifest, service worker de shell e instalação) segue o ADR 0005; no iPhone a instalação real é Adicionar à Tela de Início no Safari.
