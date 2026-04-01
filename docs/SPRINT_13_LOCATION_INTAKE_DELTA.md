# Sprint 13 — Location intelligence: repo baseline vs Master Expansion Pack

This document is the **Sprint 13 inventory** called for in the expansion review: what already exists, what the pack adds, and how to extend without duplicating models.

**Reference:** `Life_OS_Sprint_13_to_21_Master_Expansion_Pack.md` § Sprint 13 (Location Intelligence Starter).

## Current baseline (this repo)

### Data

| Piece | Location | Notes |
| ----- | -------- | ----- |
| `PlaceEvent` | [`packages/database/prisma/schema.prisma`](../packages/database/prisma/schema.prisma) | Visit-style rows: `occurredAt`, `placeLabel`, optional `placeCategory`, `durationMinutes`, `masked`, `source` (default `manual`). **No raw GPS trail.** |
| User relation | `User.placeEvents` | Standard cascade |

### API

| Method | Path | Behavior |
| ------ | ---- | -------- |
| GET | `/api/v1/place-events` | Paginated list |
| POST | `/api/v1/place-events` | Create manual (or client-labeled) event |
| DELETE | `/api/v1/place-events/:id` | Remove event |

Implementation: [`apps/api/src/routes/v1/place-events.ts`](../apps/api/src/routes/v1/place-events.ts).

### Downstream use (context signals, not core ingestion)

- **Pattern ranking:** [`apps/api/src/lib/pattern-insights.ts`](../apps/api/src/lib/pattern-insights.ts) — counts / recent place events when `patternSignalsOptIn` is on; feeds `patternRankMultiplier` in the suggestion engine.
- **Lifestyle / Phase 5 helpers:** [`apps/api/src/lib/phase5-lifestyle.ts`](../apps/api/src/lib/phase5-lifestyle.ts) — reads `PlaceEvent` for rhythm hints when lifestyle opt-in is enabled.
- **Adaptive planning:** [`apps/api/src/lib/adaptive-planning.ts`](../apps/api/src/lib/adaptive-planning.ts) — screen time adjacent to place context.
- **Digital twin summaries:** [`apps/api/src/lib/digital-twin.ts`](../apps/api/src/lib/digital-twin.ts) — aggregates recent place events for twin-style surfaces.

Core **note/event/connector** ingestion does **not** require place data.

## Gap vs Master Pack (typical Sprint 13 deliverables)

The pack calls for additional structures and services. None of the following exist as first-class tables yet:

| Pack concept | Status | Suggested direction |
| ------------ | ------ | ------------------- |
| `places` (catalog) | Missing | Add a **`Place`** (or **`SavedPlace`**) entity keyed by user, with stable id; link **`PlaceEvent.placeId`** optional FK so events can reference a saved place or stay free-text for one-off labels |
| `place_aliases` | Missing | Either columns on `Place` / JSON on catalog row, or small `PlaceAlias` table pointing at catalog id |
| `place_categories` | Partial | Today: free string on `PlaceEvent`. Pack may want enum or taxonomy table; can start with enforced string vocab + `UserSettings` |
| `place_privacy_flags` / `place_sensitivity_overrides` | Partial | Today: **`masked`** on event only. Extend with per-place sensitivity (home/work/private) on catalog row + guard in summarization |
| LocationPermissionService | Missing | API + mobile contract: “permission intent” and capability flags; no background tracking by default |
| PlaceResolutionService | Missing | Dedupe labels → catalog id; fuzzy match user-provided names |
| PlaceEventCreationService | Partial | Inline in route today; extract when catalog + validation grow |
| SensitivePlaceGuardService | Missing | Centralize redaction for briefs, tile, insights (reuse **`masked`** + future sensitivity enum) |
| LocationSuggestionService | Missing | Hook into suggestion pipeline via **modifiers** (see [`EXPANSION_SPRINTS_SIGNAL_GRAPH.md`](./EXPANSION_SPRINTS_SIGNAL_GRAPH.md)), not mandatory `intakeSignal` |

### UI gap

- No dedicated **Places** screen in pack sense (save current place, mark home/work/sensitive, inspector). Web/mobile surfaces TBD per sprint scope.

## Implementation principles (Sprint 13)

1. **Evolve `PlaceEvent` + add catalog** rather than introducing a parallel event type.
2. **Event-only storage** — no raw continuous trail; gates in master pack still apply.
3. **Opt-in** — align with `patternSignalsOptIn` / future `locationSignalsOptIn` if split from patterns.
4. **Tests called out in pack:** no raw trail persistence in event-only mode; masked/sensitive summaries; disabled location does not break POST `/notes`, brief generation, or obligations.

## Gate to Sprint 14 (from pack)

Before leaving Sprint 13:

- Extended catalog works end-to-end (`SavedPlace`, `PlaceAlias`, optional `PlaceEvent.savedPlaceId`).
- Sensitive place controls work in pattern / lifestyle / twin summaries via `sensitive-place-guard`.
- No uncontrolled background storage (`GET /places/capabilities` documents event-only mode).

## Implemented in this repo (baseline)

- Schema: `SavedPlace`, `PlaceAlias`, `PlaceSensitivity`, `PlaceEvent.savedPlaceId`, `UserSettings.locationIntelligenceOptIn`.
- API: `/api/v1/places/*`, `/api/v1/places/capabilities`, extended `POST /place-events` (resolution + saved place link).
- Services: `place-resolution-service`, `place-event-service`, `lib/sensitive-place-guard`, `lib/location-rank-modifier`.
- Web: `/places` page; Patterns links to Places.
