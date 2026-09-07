# Fase 4 — Confiabilidade e lancamento

## Objetivo

Autorizar o uso real em campo, incluindo operacao com internet instavel, recuperacao e seguranca. Ate esta fase, a producao remota do MVP permanece em validacao controlada.

## Estado real (29/08/2026)

- Chat 1 (casca PWA) concluido: manifest (`app/manifest.ts`, `display: standalone`, icones/maskable nas cores MJT), service worker estatico de shell (`public/sw.js`, cache `mjt-shell-v1` so para `/_next/static/` e `/icons/`), `Cache-Control` no SW, prompt de instalacao e banner de atualizacao com confirmacao do usuario.
- Chat 2 (fila offline de rascunhos) concluido: IndexedDB `mjt-offline-v1`, wizard em `/coletas/nova`, fila serial com lock de aba reusando as actions existentes, `p_client_item_id` aditivo, painel de pendentes no `PwaShell` e `canReload` via snapshot. Ver ADR `docs/decisions/0006-offline-draft-queue.md`.
- Chat 3 (revisao de seguranca) concluido: rate limit de login e download de share, ACL das RPCs de oficina, proxy de `/coletas`, HSTS em producao, erros de action sem vazamento e ator nos logs 500. Ver ADR `docs/decisions/0007-shared-rate-limit-login-download.md`. Migration `20260828120000_phase_4_chat3_security_acl.sql` aplicada no remoto. Os 4 gates remotos da Fase 1A permanecem adiados.
- Chat 4 (observabilidade) concluido: `app/error.tsx` / `global-error.tsx` com digest seguro, alerta fail-open via `logTransactionFailure` + `ERROR_ALERT_WEBHOOK_URL`, `GET`/`HEAD /api/health` (app + Auth/REST). Sem migration. Ver ADR `docs/decisions/0008-observability-health-alerts.md`. Follow-up humano: monitor em `/api/health` e webhook opcional.
- Chat 5 (backup/restore) **ferramentas entregues**: ADR `docs/decisions/0010-backup-restore-isolated.md`, runbook `docs/runbook-backup-restore.md`, scripts `backup:export` / `backup:verify` / `backup:restore-isolated`. **Prova humana de restore isolado: ADIADA** (29/08/2026) — operador prioriza entregar a primeira versao do app; o drill (export+verify+restore throwaway+PDF/assinatura) fica para quando houver tempo. Ate la o MVP segue em **validacao controlada** (dados sinteticos / familia), nao autorizacao plena de evidencias insubstituiveis.
- Migrations locais e remotas alinhadas ate Chat 3 ACL; em 29/08/2026 aplicadas `20260829010000` + `20260829020000` (scope `auth_login` na RPC e no CHECK da tabela de rate limit — corrige login apos Chat 3).
- Ainda faltam: prova humana do Chat 5 (adiada), testes de campo (Chat 6) e treino/go-live formal (Chat 7).
- Os 4 gates remotos da Fase 1A (RLS cruzada, concorrencia, storage privado, cleanup real) permanecem ADIADOS — ver `phase-1-collection-core.md`.
- Scan de bugs ([`system-scan-for-bugs.md`](../design-patterns/system-scan-for-bugs.md)): codigo das Fases 0–4 e 5.1–5.5/5.8–5.18 fechado em `30d8621`. Chats 5–7 desta fase **nao** sao eixos daquele inventario.

Organizacao em chats (26/08/2026): os 10 passos abaixo **nao** se executam num unico chat. Ver [Disciplina de chat](#disciplina-de-chat).

---

## Disciplina de chat

**Cada numero da tabela e um chat novo.** Nao continuar o numero seguinte no mesmo contexto. Nao misturar eixos. Encerrar o chat com gate verde (`steiger`, `lint`, `typecheck`; + `test`/`build` quando tocar codigo) antes de abrir o proximo.

Pre-flight de **cada** chat: `docs/README.md` + este arquivo + **um** doc tematico da sessao. Nao carregar `phase-3c-reconnecting-ui.md` nem o restante de `execution/`.

Ordem obrigatoria: **1 → 2 → 3 → 4 → 5 → 6 → 7**. Sem o numero anterior verde, nao comeca o seguinte.

| # | Chat | Eixo | Passos cobertos | Doc tematico extra |
| --- | --- | --- | --- | --- |
| **1** | Instalacao PWA (casca) | App instalavel + SW so de shell | Passo 1 | `docs/nextjs-pwa.md` |
| **2** | Fila offline de rascunhos | Persistencia local + sync + painel | Passos 2, 3 e 4 | `docs/nextjs-pwa.md` |
| **3** | Revisao de seguranca | RLS, Storage, rate limit, logs, autorizacao | Passo 5 | `docs/security.md` |
| **4** | Observabilidade | Erro visivel, alerta, saude | Passo 6 | — |
| **5** | Backup e restore | Banco + arquivos em ambiente isolado | Passo 7 | `docs/supabase.md` |
| **6** | Testes de campo | Android, iPhone, computador | Passo 8 | este arquivo (casos de teste) |
| **7** | Treino e go-live | Procedimento, suporte, autorizacao | Passos 9 e 10 | `docs/product/vision-and-scope.md` |

O chat **2** e um unico chat, com tres cortes sequenciais **dentro do mesmo eixo** (nao sao chats separados):

1. **2a** — gravar rascunho/itens/assinatura no dispositivo (sem replay na rede).
2. **2b** — fila + idempotencia reusando as server actions/commands ja existentes.
3. **2c** — painel de pendentes e recuperacao (incluindo aviso se o SW quiser recarregar com trabalho pendente).

Proibido no mesmo chat: instalacao + fila; fila + auditoria de RLS; observabilidade + backup; codigo + go-live. Painel de pendencias da **oficina** (Fase 3, passo 2) nao entra nesta fase — aqui o painel e so de **sync offline**.

---

## Chat 1 — App instalavel

**Faz:** completar manifest se faltar, `display: standalone`, `start_url`, icones/maskable, Service Worker **somente** do app shell (JS/CSS/icones), `Cache-Control` no SW, aviso antes de atualizar o SW, prompt de instalacao.

**Nao faz:** IndexedDB, fila, rascunho local, JWT/PDF/link assinado em cache, dados autenticados no SW.

**Aceite:** instala no Chrome Android, abre em standalone, online funciona, SW nao cacheia `/api` nem PDF.

## Chat 2 — Fila offline de rascunhos

**Faz (nesta ordem, no mesmo chat):** store local (`2a`); fila de mutacoes com idempotencia e mensagens de falha parcial (`2b`); aviso de pendentes + retry (`2c`). Rascunhos locais sao temporarios; codigo oficial, PDF e finalizacao nascem so no servidor apos sync. Reusar os commands existentes — nao inventar segundo write path.

**Nao faz:** revisao de RLS, Sentry, backup, testes de campo.

**Aceite:** fechar o navegador preserva rascunho; perder net e reconectar nao duplica coleta nem numero; operador ve pendentes de sync e consegue recuperar. **Gate deste chat:** `npm run check` em `sistema-coleta` + ADR 0006.

## Chat 3 — Revisao de seguranca

**Faz:** revisar RLS, Storage, links, rate limits, logs e autorizacao **por comando**. Zero PWA neste chat. Os 4 gates remotos da Fase 1A so correm se existir projeto isolado; senao permanecem adiados.

**Nao faz:** Service Worker, fila, observabilidade, backup.

**Aceite:** matriz em `docs/security.md`; login e download de share limitados; RPCs de oficina sem EXECUTE publico; `/coletas` protegido no proxy; HSTS em producao. **Gate deste chat:** `npm run check` em `sistema-coleta` + ADR 0007. Leaked-password protection no painel Auth continua checklist humano.

## Chat 4 — Observabilidade

**Faz:** alerta de erros, verificacao de disponibilidade / healthcheck.

**Nao faz:** backup, PWA, go-live.

**Aceite:** operador ve erro seguro com digest e retry; 500 vira log JSON e (se env) webhook; `/api/health` responde 200/503 sem vazar interno. **Gate deste chat:** `npm run check` em `sistema-coleta` + ADR 0008. Humano aponta o monitor de uptime e, se quiser, cola o webhook https.

## Chat 5 — Backup e restore

**Faz:** backup de banco e de arquivos; restauracao comprovada em ambiente isolado, inclusive PDF/assinatura. LLM ajuda no runbook; o humano executa o restore.

**Nao faz:** UI de oficina, SW, treino de usuario.

**Gate deste chat:** `npm run check` em `sistema-coleta` + ADR 0010 + runbook. Aceite operacional (PDF + assinatura no throwaway) permanece checkbox humano — ver `docs/runbook-backup-restore.md` §6.

## Chat 6 — Testes de campo

Nao e sessao de implementacao. Executar no aparelho os [casos de teste de campo](#casos-de-teste-de-campo). A LLM so escreve/atualiza o roteiro se pedido.

## Chat 7 — Treino e go-live

Nao e sessao de implementacao de codigo. Treinar usuarios, publicar procedimento curto (coleta, incidente, suporte) e autorizar a operacao real gradualmente.

---

## Passos (mapa para os chats)

1. Implementar manifest, instalacao PWA e cache controlado do aplicativo. → **Chat 1**
2. Implementar armazenamento local temporario de rascunhos, itens e assinatura, com fila de sincronizacao. → **Chat 2** (`2a` + `2b`)
3. Garantir idempotencia e mensagens claras para sincronizacao repetida ou falha parcial. → **Chat 2** (`2b`)
4. Criar painel/aviso de itens pendentes de sincronizacao e estrategia de recuperacao. → **Chat 2** (`2c`)
5. Revisar RLS, Storage, links, rate limits, logs e autorizacao de cada comando. → **Chat 3**
6. Configurar observabilidade, alerta de erros e verificacao de disponibilidade. → **Chat 4**
7. Configurar backup de banco e de arquivos; executar restauracao em ambiente isolado. → **Chat 5**
8. Realizar testes de campo em Android, iPhone e computador, com conexao lenta/interrompida. → **Chat 6**
9. Treinar usuarios e publicar procedimento curto de coleta, incidente e suporte. → **Chat 7**
10. Autorizar a operacao real gradualmente, acompanhando primeiras guias e indicadores. → **Chat 7**

## Casos de teste de campo

Usar no **Chat 6** (depois dos chats 1–5 verdes):

- Perder internet antes e depois de assinar.
- Fechar e reabrir o navegador antes de sincronizar.
- Tentar finalizar duas vezes apos reconectar.
- Compartilhar PDF por WhatsApp e abrir QR em outro celular.
- Tentar acessar documento com usuario sem permissao.
- Restaurar banco e arquivo de evidencia em ambiente isolado.

## Criterios de lancamento

- Nenhum dado de teste existe na producao.
- Backup e restauracao foram comprovados, inclusive para PDFs/assinaturas.
- Equipe sabe identificar coleta pendente de sincronizacao.
- Responsavel da MJT aprovou visual da guia, textos e dados institucionais ativos.
- Ha responsavel definido para suporte, acessos e incidentes.
