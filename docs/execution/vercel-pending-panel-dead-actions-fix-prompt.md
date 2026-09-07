# Fix prompt — pending panel leftover discard (`immutable_record`)

| Campo | Valor |
| --- | --- |
| **Status** | **Closed** on Production 2026-09-06 (second re-walk) |
| **Shipped** | `3098350` (panel/drain) + `4d709c4` (`fix leftovers` — `immutable_record` purge) |
| **App** | `https://sistema-de-coleta.vercel.app` |

Waves 2–3 and most of Wave 1 were already closed. Check 2 (leftover **Descartar** confirm OK) is now closed too: `immutable_record` purges the local tree like `collection_not_draft` / `not_found`.

Do **not** re-implement. Do not discard walk `4bf31deb-…` / `MJT-2026-000001` or `MJT-2026-000002`.

---

## Remaining work

**None.** Auto-drain on dashboard after `4d709c4` cleared the pending card. No **Coletas pendentes** / **Ver pendentes** / **Descartar rascunho**.

The leftover URL `/coletas/e1f57d1a-…/itens` now hydrates as **Sincronizado** from the server (1 item). That is the kept server draft, not the poisoned IDB queue. The popup is gone.

---

## Already done — do not redo

| Wave | What shipped | Re-walk |
| --- | --- | --- |
| **1** | Discard preempts failed finalize; `immutable_record` → purge local + official kept; confirm Cancel; discard busy | Checks **1**, **2**, **5** |
| **2** | No `collection_incomplete` retry storm; **Completar coleta** + location PT | Check **3** |
| **3** | **Continuar** → `/revisao`; same-URL collapse; editable local; nova coleta required location | Checks **4**, **7** |
| **4** | `MJT-2026-000002` **Coletada**. Walk `000001` hub + Documentos versão 1 | Checks **6**, **8** |

---

## Re-walk

| # | Check | Result | Evidence |
| --- | --- | --- | --- |
| 1 | **Descartar** confirm Cancel → draft stays | **pass** | 2026-09-06 first walk |
| 2 | **Descartar** confirm OK → panel gone | **pass** | 2026-09-06 after `4d709c4`: dashboard has no pending card. Leftover `/itens` is **Sincronizado**, no panel |
| 3 | **Tentar de novo** not idle | **pass** | First walk |
| 4 | **Continuar** leaves `/itens` trap or closes panel | **pass** | First walk |
| 5 | **Fechar** / **Ver pendentes** | **pass** | First walk |
| 6 | New coleta with location finalizes | **pass** | `MJT-2026-000002` still on dashboard |
| 7 | No location → cannot emit | **pass** | First walk |
| 8 | Walk `MJT-2026-000001` hub + PDF | **pass** | Hub still **Coletada** + `collection.finalized` after leftover purge |
