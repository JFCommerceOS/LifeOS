# Phase 1 gap analysis (blueprint `02` vs repo)

Source: [`Life_OS_Full_Phases_0_7_Blueprint_Pack/02_PHASE_1_FOLLOW_THROUGH_ENGINE.md`](../Life_OS_Full_Phases_0_7_Blueprint_Pack/02_PHASE_1_FOLLOW_THROUGH_ENGINE.md).  
Purpose: list **concrete** gaps so Phase 1 work does not overlap Phase 2+ and does not re-scaffold Phase 0.

**Last reviewed:** 2026-03 — `snooze` / `false_positive` / dismiss audit rows are implemented in [`suggestions.ts`](../apps/api/src/routes/v1/suggestions.ts); [`DismissalRule`](../packages/database/prisma/schema.prisma) patterns feed [`dismissCount`](../apps/api/src/lib/suggestion-dismissal-count.ts) into [`mediateSuggestion`](../apps/api/src/services/brief-engine.ts) for repetition control.

Legend: **Done** = meets or approximates the doc; **Partial** = exists but insufficient for §9 acceptance; **Gap** = missing or stub only.

## APIs (doc §7)

| Requirement | Repo | Status |
|---------------|------|--------|
| Obligation detail returns evidence | [`obligations.ts`](../apps/api/src/routes/v1/obligations.ts) `GET :id` uses nested `evidenceItem` query; may miss some link paths | **Partial** — verify evidence for obligation-linked suggestions |
| Suggestion detail returns rank factors | [`GET /suggestions/:id`](../apps/api/src/routes/v1/suggestions.ts) includes `rankFactors` | **Done** |
| Daily brief returns buckets | [`briefs.ts`](../apps/api/src/routes/v1/briefs.ts) + [`brief-engine`](../apps/api/src/services/brief-engine.ts) | **Partial** — `before_meeting` (next `Event`) and `watch_week` (open obligations due in 7d outside do-now/today) when data exists; still depends on having events/obligations |
| Suggestion actions: confirm / dismiss / **snooze** / **false_positive** | [`suggestions.ts`](../apps/api/src/routes/v1/suggestions.ts) — `accept` / `dismiss` / `snooze` / `false_positive` + `snoozedUntil` on `Suggestion` | **Done** |

## Detection & ranking (doc §4)

| Requirement | Repo | Status |
|-------------|------|--------|
| Inputs: calendar, tasks, notes, docs, email stub | Connectors stub; notes yes; events/tasks tables exist, light use | **Partial** |
| Detection: reply owed, follow-up, review, due, event-tied, aging | [`extraction.ts`](../apps/api/src/services/extraction.ts), note ingestion | **Gap** — keyword heuristics only; no aging/event-tie logic |
| Ranking: urgency, importance, confidence, aging, event timing, user importance, failure cost | [`suggestion-engine.ts`](../apps/api/src/services/suggestion-engine.ts) | **Partial** — simple rank from due date heuristic |

## Daily Brief (doc §4 buckets)

| Bucket | Repo | Status |
|--------|------|--------|
| Do now / Do today / Needs confirmation | [`brief-engine.ts`](../apps/api/src/services/brief-engine.ts) | **Partial** |
| Before next meeting / Watch this week | Same — populated when next `Event` / obligations in horizon exist | **Partial** — depends on user data |

## User actions (doc §4)

| Action | Repo | Status |
|--------|------|--------|
| Confirm obligation | Obligation `status` / flows | **Partial** |
| Dismiss suggestion | Implemented | **Done** |
| Resolve item | PATCH obligation | **Done** |
| Edit due date | PATCH obligation `dueAt` | **Done** |
| Mark false positive | `false_positive` action + `DismissalRule` + feedback | **Done** |
| Create reminder | `Reminder` model exists; **no** CRUD route in v1 | **Gap** |

## UI (doc §8)

| Requirement | Repo | Status |
|-------------|------|--------|
| Daily Brief: priorities, why, confidence/evidence, one-tap action | [`HomeBrief.tsx`](../apps/web/src/pages/HomeBrief.tsx) | **Partial** — buckets, “Why” on oneLine, links; **inline dismiss/snooze/false positive** for suggestion rows; confidence/evidence drill-in still thin |
| Obligation Center: filters, evidence count, linked entities, correction | [`Obligations.tsx`](../apps/web/src/pages/Obligations.tsx) | **Partial** — patch done/dismiss; no filters, evidence count UI, links, correction UX |

## Acceptance §9 (end-to-end)

| Criterion | Status |
|-----------|--------|
| Real open-loop detection | **Gap** — heuristic / stub |
| Daily Brief from live data | **Partial** — yes after scripts |
| Act on suggestions | **Partial** — API yes; UI thin |
| False positives marked | **Done** (API + lifecycle) |
| Ranking factors visible (debug/detail) | **Partial** — API returns factors on suggestion detail; web does not surface |
| Full flow note → … → user action | **Partial** — possible via API + scripts; UI incomplete |

## Recommended Phase 1 implementation order (avoid overlap)

1. **Engine:** deepen detection/ranking in small services (no Phase 2 tables).
2. **Brief:** populate all buckets when data exists; optional “before next meeting” from next `Event`.
3. **UI:** Brief + Obligations per §8; link to suggestion detail for evidence/rank factors.
4. **Reminders:** optional `POST/PATCH /reminders` if doc requires “create reminder” for acceptance.

Do **not** add `Person`, purchases, or location tables while closing these gaps — that is Phase 2+.
