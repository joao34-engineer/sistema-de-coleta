# Runbook — Backup e restore (Coleta MJT)

| Campo | Valor |
| :--- | :--- |
| **Status** | current |
| **Authority** | informative |
| **Owner** | sistema-coleta / operação MJT |
| **ADR** | [0010](decisions/0010-backup-restore-isolated.md) |
| **Last updated** | 2026-08-29 |

> Zero data loss: nunca `db reset`, `drop` ou restore no projeto remoto do MVP. Restore só em throwaway. Ver `docs/supabase.md` e ADR 0002.

---

## 1. O que entra no backup

| Peça | Como |
| --- | --- |
| Postgres (schema + dados de app) | `npm run backup:export` → `dump.sql` via `supabase db dump --linked` |
| Storage | Mesmo comando baixa os quatro buckets privados |
| Manifesto | `manifest.json` com path, byteSize, sha256 (sem PII) |

Buckets: `organization-assets`, `collection-evidences`, `collection-signatures`, `collection-documents`.

**Não coberto pelo dump de app:** usuários Auth. Em restore de drill, crie o admin no painel do throwaway se precisar entrar na UI.

---

## 2. Cadência

- Antes do go-live (Chat 7) e sempre que houver volume material de guias/PDFs.
- Após incidente ou antes de mudança arriscada de schema (além do dry-run usual).
- Guardar bundles em pasta **fora do repositório** (ex.: `Documents/backups-coleta-mjt/<data-iso>/`).

---

## 3. Export (MVP — Account A)

Pré-requisitos no `.env.local` (valores reais, nunca commitados):

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `SUPABASE_CONFIRM_PROJECT_REF`
- `BACKUP_OUTPUT_DIR` — caminho absoluto **fora** do repo

```powershell
cd sistema-coleta
npm run backup:export
npm run backup:verify
```

Esperado: JSON de contagens (objetos por bucket) sem paths sensíveis além do layout UUID; `backup:verify` exit 0.

---

## 4. Throwaway (Account B)

1. Projeto Supabase **vazio** em conta/org separada (ou slot livre).
2. **Não** conectar GitHub a este repo.
3. **Não** rodar `supabase link` do app contra o throwaway.
4. No `.env.local` do operador, além do MVP, definir:

```env
RESTORE_SUPABASE_URL=https://<throwaway-ref>.supabase.co
RESTORE_SUPABASE_SECRET_KEY=<service_role do throwaway>
RESTORE_CONFIRM_PROJECT_REF=<throwaway-ref>
RESTORE_DATABASE_URL=<connection string Postgres do throwaway>
```

`RESTORE_DATABASE_URL`: painel do throwaway → Settings → Database → connection string (URI). Usar sessão com `psql` disponível no PATH.

---

## 5. Restore isolado

```powershell
cd sistema-coleta
$env:BACKUP_INPUT_DIR = "C:\Users\...\Documents\backups-coleta-mjt\<data-iso>"
npm run backup:restore-isolated
```

O script:

1. Recusa se o ref do throwaway == ref do MVP.
2. Aplica `dump.sql` via `psql` em `RESTORE_DATABASE_URL`.
3. Faz upload dos objetos em `storage/`.
4. Loga só contagens.

Prova de aceite:

- Abrir um objeto em `collection-documents` (PDF).
- Abrir um objeto em `collection-signatures` (PNG).
- Registrar abaixo e em `docs/execution/phase-4-hardening-launch.md`.

Depois: **apagar** o projeto throwaway.

---

## 6. Evidência do drill (humano)

**Status: ADIADA (29/08/2026).** Ferramentas prontas; o operador adiou o drill para priorizar a primeira versao do app. Ate preencher esta tabela, o ambiente permanece validacao controlada (ADR 0002 / criterios de lancamento da Fase 4).

| Campo | Valor |
| --- | --- |
| Data | _adiado_ |
| Bundle path (local) | _adiado_ |
| Throwaway ref (não secret) | _adiado_ |
| PDF OK | _adiado_ |
| Assinatura OK | _adiado_ |
| Throwaway apagado | _adiado_ |

---

## 7. Se o MVP remoto for danificado

1. **Não** usar `db reset` / wipe no projeto live.
2. Restaurar a partir do último bundle válido — preferencialmente num projeto novo e, só após validação, cutover controlado (fora deste runbook mínimo).
3. Auth: recriar admin no painel se o dump não trouxe `auth.users`.
4. Abrir incidente: responsável de acessos + suporte Supabase se necessário.

PITR (plano pago) no painel é complementar; não substitui o bundle dump+Storage deste repositório.

---

## 8. Comandos npm

| Script | Função |
| --- | --- |
| `backup:export` | Dump + Storage + manifesto |
| `backup:verify` | Re-hash local vs manifesto |
| `backup:restore-isolated` | Restore só com `RESTORE_*` ≠ MVP |
