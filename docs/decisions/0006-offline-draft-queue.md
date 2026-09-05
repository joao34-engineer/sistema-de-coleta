# ADR 0006 — Fila offline de rascunhos (IndexedDB)

- Status: aceito para a Fase 4, Chat 2
- Data: 2026-08-27
- Escopo: persistência local de rascunhos, fila serial de mutações, painel de pendentes e `canReload`

## Contexto

A casca PWA (ADR 0005) cacheia só shell. HTML/RSC é network-only. Sem persistência no dispositivo, fechar o navegador no meio da captura perde o rascunho. Um segundo write path (status Postgres `pendente_sincronizacao`, Workbox Background Sync, cache de documento) duplicaria autoridade documental.

## Decisões

1. **Local-first na captura, servidor como única autoridade documental.** IndexedDB (`mjt-offline-v1`) guarda rascunho, itens, PNG de assinatura e a fila. Número oficial, PDF e status `collected` nascem só depois do sync confirmado.

2. **Sem cache de HTML/API/PDF no service worker.** Continuidade é na sessão já aberta (perda de net no meio da captura). Reabrir o PWA totalmente offline não é garantia deste chat.

3. **Um write path.** A fila replaya as server actions/commands existentes. UUID de coleta e de item nascem no cliente. `create_draft` já é idempotente pelo id. `create_collection_item` ganha `p_client_item_id` (migration aditiva) para replay não duplicar peça. Finalize reusa a mesma `Idempotency-Key`.

4. **Pendente só no cliente.** Não há status `pendente_sincronizacao` no Postgres. Escopo IndexedDB por `userId` (+ `organizationId`); leitura entra como `unknown` e passa em schema Zod.

5. **Drain serial com lock de aba.** `navigator.locks` (`mjt-offline-drain`). Sem `navigator.locks` (Safari), o fallback é mutex em fila: callers posteriores esperam e executam, nunca descartam. No boot do drain, mutações `in_flight` voltam a `pending` (crash no meio do sync). 409 `stale_version`: um GET, atualiza versão, uma repetição. 401 não apaga o local. Assinatura já presente no servidor é pulada. Dispara em online, boot autenticado e retry. Nunca no SW.

6. **`canReload` síncrono.** Snapshot em memória, atualizado na escrita/drain. O callback do `PwaShell` não abre IndexedDB. Reload não apaga IDB; o banner avisa trabalho pendente antes de confirmar o update.

## Consequências

- Fechar o browser preserva o rascunho; retomar com internet não duplica coleta nem número, desde que o UUID local seja o mesmo.
- iOS pode evictar IndexedDB; PII (assinatura PNG, CPF/telefone) é temporária e apagada após finalize confirmado. Teste de campo é Chat 6.
- A migration `p_client_item_id` é aditiva e precisa ser aplicada no projeto remoto único do MVP (nunca reset).

### Emenda (B12 / eixo 1.3) — rotas do wizard

`/coletas/nova` é **somente** a entrada de uma captura nova (cliente). Após criar o rascunho, as etapas vivem em deep links:

- itens → `/coletas/{id}/itens`
- revisão → `/coletas/{id}/revisao`
- assinatura → `/coletas/{id}/assinatura`

A URL sincroniza com `router.replace` na troca de etapa. Em `reload()`, `initialStep` da rota vence `currentStep` do IndexedDB e o IDB é realinhado. Alias legado `?rascunho=` em `/coletas/nova` redireciona para `/coletas/{id}/itens`.

### Emenda (Fase 2 / B16–B22) — recover, discard e hydrate

- Drain autentica, recupera `in_flight` → `pending` e corre sob o lock serial `mjt-offline-drain`.
- `discard_draft` replaya `discard_collection_draft` (só `status = draft`). Rascunho nunca sincronizado some só no IDB. Cliente cadastrado não é apagado.
- Hydrate de rascunho remoto usa `getCustomer` / `loadCustomerDto`. Sem CPF/telefone inventados e sem usar o UUID da coleta como cliente. Se o hydrate abortar, o wizard de itens não fica operacional: a página mostra o erro e retry.
- Confirm de descarte no banner usa a mesma regra de `shouldEnqueueServerDiscard` (`serverRowVersion` ou `create_draft` `done`/`in_flight`).
- Purge de `discard_draft` com `collection_not_draft` / `not_found` limpa o IDB e explica que a guia oficial não foi apagada.
- Endereço cadastral só vai ao servidor com rua + cidade + UF. Street sozinha permanece no aparelho.
- Finalize da guia exige PNG confirmado no pad (`drawn` → `confirmed`).

## Fora do escopo

Fila de evidências/fotos, cache HTML no SW, Workbox/Background Sync, status Postgres de pendência, Serwist, observabilidade, RLS, backup, testes de campo.
