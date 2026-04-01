# Life OS — Assistant Mediation Engine (adapted blueprint)

This document adapts the external **Assistant Mediation Engine** blueprint to **Life OS locked product truths**, **phase gates**, and **agent role lenses** (system architecture, SOP, AI/LLM contracts, psychology). It is **authoritative for how we extend** mediation; numbered phase packs (`Life_OS_Full_Phases_0_7_Blueprint_Pack/*`) still govern **what ships in which phase**.

---

## 1. Role-lens orientation (recall)

| Lens | Implication for mediation |
|------|---------------------------|
| **Senior system architect** | Mediation lives in **`apps/api`** behind explicit contracts; **watch/tile** consume **redacted** payloads (`TileDisplayModel`, companion rules)—never raw connector dumps. No “second brain” on the edge. |
| **SOP & workflow expert** | Small services, Zod on inputs, Prisma migrations, paginated list APIs, acceptance criteria per increment—see §8. |
| **AI / LLM developer** | Mediation decisions are **deterministic and explainable** in the current engine; any future ML is **optional**, **bounded**, and **audited**—not a replacement for traceable rules. |
| **Psychologist (trust & load)** | **Silence is a feature**; fewer, well-timed surfaces beat noisy “help.” Tone: calm continuity—**no guilt-based nudging**. User always has dismiss/snooze/correct paths. |
| **Product anchor** | **Local-first** continuity core today: **`server_api` + PostgreSQL** (see `apps/api/src/lib/ecosystem-manifest.ts`). Phone-owned memory remains a **target**, not assumed in every path. |

---

## 2. Core principle (unchanged)

**Nothing user-facing should bypass mediation policy.**

Intended pipeline:

`Signal → Capability (permission/trust) → Domain tone (if applicable) → **Mediation** → Surface policy → Delivery`

“Capability” and “domain” integration must stay **loosely coupled**: optional signals belong in the **Context Signals Layer**, not hardwired into core ingestion (early phases).

---

## 3. What mediation solves (product + psychology)

| Without mediation | With mediation |
|-------------------|----------------|
| Notification fatigue | **Intentional** frequency caps |
| Wrong surface (e.g. heavy UI on watch) | **Surface-appropriate** routing |
| Trust erosion | **ASK** / explain before **SURFACE** when trust is low |
| Cognitive overload | **Suppress / defer** for non-critical items under load |

---

## 4. Decision vocabulary (schema-aligned)

The Prisma enum `MediationDecision` already includes the blueprint set:

`suppress` · `defer` · `nudge` · `ask` · `surface_now` · `escalate` · `route_to_phone` · `route_to_watch` · `route_to_tile`

**Implementation:** Pure decision logic lives in `apps/api/src/services/assistant-mediation-decision.ts` (`decideMediation`). The orchestrator `mediateSuggestion` loads user state, applies optional **`trustScore`**, **`sensitivityClass`**, **`dismissCount`**, logs to `AssistantMediationLog`, and returns the full **`MediationDecision`** enum (including `ask`, `escalate`, `route_to_phone` | `route_to_watch` | `route_to_tile`, plus `suppress`, `defer`).

---

## 5. Inputs (blueprint vs repo)

| Blueprint input | Repo / service status |
|-----------------|------------------------|
| `capability_key` | Partially via **capability catalog** + behaviors (`services/capability-*`). Mediation entry point today accepts **entity + rank + confidence**. |
| `domain_context` | **Adaptive domain** services exist (`adaptive-domain-service`, `domain-tone-service`); **not yet first-class** in `mediateSuggestion` input. |
| `user_state` | **`UserStateSnapshot.stateType`** (heuristic, explainable—see `user-state-service`). |
| `trust_score` / `sensitivity_class` | **Surface policies** + privacy (`SurfaceDeliveryPolicy`); **not yet unified** into a single mediation score in the service. |
| `priority_score` | Mapped via **`rank`** + confidence. |
| `timestamp` | Log `createdAt`; **no explicit “event time”** in mediate body yet. |
| `geo_context` | Optional signals layer only—**not** core ingestion. |
| `surface_context` | **`surface-orchestration-service`** / `listSurfacePolicies`. |
| `recent_interaction_history` | **Future**: dismissal/snooze patterns; **repetition control** rule exists in blueprint, partial in product. |

---

## 6. Decision dimensions (rules)

Blueprint rules map to **explainable** heuristics:

1. **Overload protection** — Implemented path: `overloaded` / `social_drain` → suppress/defer low rank/confidence.  
2. **Sensitivity gate** — **Enforce** via **redaction** + **surface** (tile/watch); high-sensitivity content must not expand scope silently.  
3. **Trust gate** — Blueprint: **ASK** when trust low; **implement** as explicit decision + `reasonSummary`.  
4. **Repetition control** — Tie to **suggestion lifecycle** / dismiss counts—**future work**.  
5. **Domain tone** — `domain-tone-service` exists; **wire into mediation** as an increment.  
6. **Surface routing** — Partially implemented; **watch/tile** must respect **minimal payloads** and **privacy** for edge clients.

---

## 7. Persistence & audit

| Artifact | Status |
|----------|--------|
| `AssistantMediationLog` | **Implemented** — `reasonSummary`, `confidence`, decision, surface. |
| `mediation_rules` (configurable rules table) | **Not in schema** as named in the original paste; **optional Phase 8+**—prefer **versioned config** or DB rules **without** breaking existing logs. |

---

## 8. Services (blueprint map)

| Blueprint | Repo |
|-----------|------|
| `AssistantMediationService` | Orchestrator: **`assistant-mediation-service.ts`** (extend `decideFromState`). |
| `PriorityScoringService` | Today **rank/confidence** come from callers (e.g. brief path); **extract** if duplication grows. |
| `TimingDecisionService` | Collapsed into **`defer` / `suppress`**; split if logic grows. |
| `SurfaceRoutingService` | Split between **`mediation-service`** + **`surface-orchestration-service`**. |
| `LoadRegulationService` | **`overloaded` / `social_drain`** branches in `decideFromState`. |

---

## 9. API (versioned under `/api/v1`)

| Blueprint | Current |
|-----------|---------|
| `POST /assistant/mediate` | **`POST /api/v1/assistant/mediate`** — Zod body: `sourceEntityType`, `sourceEntityId`, `rank`, `confidence`, optional `trustScore`, `sensitivityClass`, `dismissCount`. |
| `GET /assistant/mediation-log` | **`GET /api/v1/assistant/mediation-logs`** — query `limit`. |
| `GET /assistant/decision/:id` | **`GET /api/v1/assistant/mediation-logs/:logId`** and alias **`GET /api/v1/assistant/decisions/:logId`** — single log for the current user. |

---

## 10. UI / UX (explainability)

- **“Why this appeared”** — Every surfaced item should remain traceable to **`reasonSummary`** + policy (Settings assistant section already surfaces **state**; **align** copy with calm, non-judgmental tone).  
- **Rules:** less is more; **silence is intentional**; **no spam**; respect **mental load** (see role lens).

---

## 11. Integration (locked boundaries)

Mediation must integrate **without**:

- bypassing **privacy / export / correction** flows;  
- sending **unredacted** payloads to **tile/watch**;  
- introducing **cloud-required** mediation;  
- **opaque** “one model decides everything” endpoints without **audit fields**.

Integrate **with**: Capability Registry, Language stack, Surface policies, User state (heuristic), **future** domain adapters.

---

## 12. Build order (adapted — incremental, phase-safe)

Aligned with **09_CURSOR_MASTER_EXECUTION_RULES.md** (no scope mixing):

1. **Harden** — Expand `decideFromState` to use **full enum** where product needs (e.g. `ask`, `route_to_*`) with **tests** and **log compatibility**.  
2. **Unify inputs** — Optional Zod body fields for `capabilityKey`, `sensitivityClass`, `trustHint`—**feature-flag** or versioned.  
3. **Domain + tone** — Call `domain-tone-service` for **reason string** only (deterministic).  
4. **Repetition** — Read dismiss/snooze from **suggestion lifecycle** / DB.  
5. **Explanation API** — Stable DTO for “why + timing + surface” for web + future mobile.  
6. **Rules storage** — Only if product needs runtime toggles—prefer **migrations + clear naming**.

---

## 13. Completion definition (acceptance)

Mediation increments are **done** when:

- [x] No silent bypass of mediation on **brief/suggestion** paths that claim to be mediated — [`brief-engine`](../apps/api/src/services/brief-engine.ts) calls `mediateSuggestion` per ranked suggestion; obligations/events/tile lines are **out of scope** for mediation (see §11 and [`tile-presentation`](../apps/api/src/services/tile-presentation.ts) JSDoc).  
- [x] Logs are written for **mediate** calls used in production — [`AssistantMediationLog`](../packages/database/prisma/schema.prisma) via [`assistant-mediation-service`](../apps/api/src/services/assistant-mediation-service.ts).  
- [x] **Edge surfaces** receive only **policy-compliant** payloads — [`buildTileDisplayModel`](../apps/api/src/services/tile-presentation.ts) applies redaction; mediation does not gate tile lines; watch/tile policy thresholds live in [`surface-orchestration-service`](../apps/api/src/services/surface-orchestration-service.ts).  
- [x] User-facing copy stays **calm** and **explainable**; dismiss/correct paths remain — Settings shows recent mediation audit rows; domain tone appends deterministic phrasing to `reasonSummary`.  
- [ ] Load tests / manual checks show **reduced noise** under `overloaded` states (heuristic) — **open** (no automated load suite in-repo).

---

## 14. Cursor implementation notes (for agents)

**Do**

- Extend **`assistant-mediation-service.ts`** with small, testable functions.  
- Keep **Zod** strict; add fields with `optional()` and migration discipline.  
- Add **Vitest** coverage for decision branches.  

**Do not**

- Add **direct LLM** calls as the sole mediation gate.  
- **Bypass** mediation from **brief-engine** or suggestion ranking without a documented exception.  
- **Spam** notifications or ignore **sensitivity** / **surface** redaction.

---

## 15. Source

Adapted from user-supplied `Life_OS_Assistant_Mediation_Engine_Blueprint.md`, reconciled with this repository (`apps/api` as of 2026).
