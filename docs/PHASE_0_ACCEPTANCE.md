# Phase 0 acceptance checklist

Maps to [`Life_OS_Full_Phases_0_7_Blueprint_Pack/01_PHASE_0_FOUNDATION.md`](../Life_OS_Full_Phases_0_7_Blueprint_Pack/01_PHASE_0_FOUNDATION.md) §11 and [`09_CURSOR_MASTER_EXECUTION_RULES.md`](../Life_OS_Full_Phases_0_7_Blueprint_Pack/09_CURSOR_MASTER_EXECUTION_RULES.md) §8 Phase 0 gates.

## Preconditions

- Repository root `.env` with non-empty `DATABASE_URL` (see root `README.md`).
- Dependencies: `pnpm install`.
- Database: `pnpm db:bootstrap` (Docker) or `pnpm db:migrate` (existing Postgres).

## 0. Automated gate (optional)

| Step | Command | Pass criteria |
|------|---------|---------------|
| 0.1 | `pnpm check` | Runs `db:generate`, typecheck, `turbo` build, lint, and test (same shape as CI). |

## 1. Repo and API boot

| Step | Command / action | Pass criteria |
|------|------------------|---------------|
| 1.1 | `pnpm build` | Completes without errors. |
| 1.2 | `pnpm --filter @life-os/api dev` | API listens (default `http://127.0.0.1:3000`). |
| 1.3 | `GET /health` | `200` body `{ "ok": true }`. |
| 1.4 | `GET /api/v1/health` | `200` body includes `ok: true` and `service: "life-os-api"`. |
| 1.5 | `GET /api/v1/unknown-route` | `404` JSON `{ "error": { "code": "NOT_FOUND", ... } }`. |

## 2. Settings and privacy

| Step | Action | Pass criteria |
|------|--------|---------------|
| 2.1 | `GET /api/v1/settings` | `200` with `settings` object. |
| 2.2 | `GET /api/v1/privacy` | `200` with privacy fields. |

## 3. Connectors and source records

| Step | Action | Pass criteria |
|------|--------|---------------|
| 3.1 | `POST /api/v1/connectors` with `{ "type": "stub", "name": "Test" }` | `201` with `connector`. |
| 3.2 | `POST /api/v1/connectors/:id/sync` | `200` with `recordsCreated` (stub). |
| 3.3 | `GET /api/v1/source-records` | `200` paginated `data` (may be empty). |
| 3.4 | `POST /api/v1/source-records` with `connectorId`, `payloadJson` | `201` and row in DB; `audit_logs` has `source_record.create`. |

## 4. Notes → obligations → suggestions → brief

| Step | Action | Pass criteria |
|------|--------|---------------|
| 4.1 | `POST /api/v1/notes` body `{ "body": "please reply to client by Friday" }` | `201` with `note`. |
| 4.2 | `GET /api/v1/obligations` | At least one open obligation if extraction heuristics matched. |
| 4.3 | From repo root: `pnpm suggestions:recompute` | Script exits 0; pending `suggestions` may appear. |
| 4.4 | `pnpm brief:generate` | Script exits 0; `GET /api/v1/briefs/daily/latest` returns a `brief` with `items`. |

## 5. Evidence and audit

| Step | Action | Pass criteria |
|------|--------|---------------|
| 5.1 | After 4.x, query DB or use API | `evidence_items` rows exist for suggestions where applicable. |
| 5.2 | Inspect `audit_logs` | Rows for mutations (notes, connectors, source-records, etc.). |

## 6. Web UI (optional smoke)

| Step | Action | Pass criteria |
|------|--------|---------------|
| 6.1 | `pnpm --filter @life-os/web dev` | App loads at `http://127.0.0.1:5173`. |
| 6.2 | Open Brief, Obligations, Notes, Settings | Pages load without console errors. |

## Phase 0 complete when

- Gates in §1–2 pass and **§4** end-to-end flow runs at least once.
- No Phase 1 features required (see blueprint `09` §8).

---

**Verify audit logs in SQL (example):**

```sql
SELECT "action", "createdAt" FROM "AuditLog" ORDER BY "createdAt" DESC LIMIT 20;
```

**Verify evidence (example):**

```sql
SELECT id, kind, summary FROM "EvidenceItem" ORDER BY "createdAt" DESC LIMIT 20;
```
