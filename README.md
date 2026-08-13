# Sistema de Coleta MJT

Aplicacao independente para registrar coletas, emitir guias digitais assinadas e acompanhar o ciclo operacional ate a entrega.

## Estado

Planejamento aprovado; implementacao ainda nao iniciada.

## Isolamento

Esta pasta possui repositorio Git proprio e deve permanecer ignorada pelo repositorio-raiz. Ela tera projeto Supabase, credenciais, deploy, dominio e historico de Git independentes.

## Direcao tecnica decidida

- Next.js com TypeScript e App Router, como PWA mobile-first.
- Supabase: PostgreSQL, Auth e Storage privado.
- Camada de aplicacao no servidor Next.js para comandos criticos.
- PDF imutavel, QR Code de verificacao e auditoria por evento.

Nao utilizar acesso administrativo do Supabase no navegador, nem emitir PDF ou numero oficial diretamente pelo cliente.

## Como ler a documentacao

Comece por [AGENTS.md](AGENTS.md), depois [docs/README.md](docs/README.md). Os documentos de execucao em `docs/execution/` sao deliberadamente pequenos (menos de 500 linhas cada) e devem ser executados na ordem indicada.

## O que ainda nao existe

Nao ha codigo, banco, projeto Supabase ou integracoes configuradas. Os documentos descrevem a referencia para a futura implementacao.
