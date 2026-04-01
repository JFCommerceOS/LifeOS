# Capability Center + Permission Control — adapted plan (repo‑aligned)

This adapts **Life_OS_Capability_Center_Permission_Control_Pack** to the **current Life OS monorepo**: what exists, what it maps to, gaps, and recommended order. **Milestone name:** *Trust‑Controlled Assistant Core* (unchanged from the pack).

---

## 1. Alignment with locked product truths

- **Local‑first**, **brief + obligations** spine, **privacy / evidence / correction** first‑class.
- **Companion surfaces** stay minimal; control plane does not expand watch/tile runtime scope here.
- **Language/voice** remains **modality‑honest** (no flat “supported” checkbox).

---

## 2. Schema mapping (pack §5 → Prisma)

| Pack concept | In repo | Notes |
|--------------|---------|--------|
| `capability_registry` | `UserCapabilityRegistry` → table `capability_registry` | `runtime_state` = `not_enabled` \| `passive` \| `active`; `activation_level` is `Int` (1–4 style tiers), not enum labels in DB |
| `capability_permissions` | `CapabilityPermission` → `capability_permissions` | Pack’s `permission_status` is approximated by **`granted`** + **`revoked_at`** (no separate REQUESTED/GRANTED enum yet) |
| `capability_behavior_policies` | `CapabilityBehaviorPolicy` | `sensitivity_policy_json` in pack → `surface_policy_json` + JSON fields today; **no separate `sensitivity_policy_json` column** |
| `capability_activation_events` | `CapabilityActivationEvent` | Matches audit intent |
| `capability_feedback_metrics` | `CapabilityFeedbackMetrics` | Trust signals |
| `surface_delivery_policies` | `SurfaceDeliveryPolicy` | `surface_type` uses `AssistantSurfaceType` enum (phone, watch, tile, …) |
| `supported_languages` | `SupportedLanguage` | Single `languageTag` (BCP‑47) vs pack’s split `language_code` + `locale_code` |
| `language_provider_policies` | `LanguageProviderPolicy` | FK to `SupportedLanguage` |
| `user_language_preferences` | `UserLanguagePreference` | Matches |

**Display names / categories:** pack lists `display_name`, `category` on registry — **catalog** supplies human copy via `capability-catalog.ts` (`CAPABILITY_DEFINITIONS`), merged at read time in services, not duplicated on every row.

---

## 3. Services mapping (pack §6 → `apps/api/src/services`)

| Pack service | Repo | Status |
|--------------|------|--------|
| CapabilityRegistryService | `capability-registry-service.ts` | Implemented |
| PermissionPurposeService | `capability-permission-service.ts` + `capability-catalog.ts` | Implemented (purpose copy in catalog) |
| ActivationPolicyService | `capability-activation-service.ts` | Implemented |
| BehaviorRightsService | `capability-behavior-service.ts` | Implemented |
| TrustScoringService | `capability-trust-service.ts` | Implemented |
| SensitivityPolicyService | Partially in behavior + surface JSON | **No standalone service**; pack’s “intimate/financial/health” rules can layer incrementally |
| SurfacePolicyService | `surface-orchestration-service.ts` | Implemented |
| LanguageCapabilityService | `language-stack.ts` + registry API | Implemented |
| LocaleVoicePolicyService | `language-stack.ts` (`routeStt` / `routeTts`) | Stub providers until wired |

---

## 4. API mapping (pack §7 → actual routes)

**Capabilities**

| Pack | Repo |
|------|------|
| `GET /capabilities` | `GET /api/v1/capabilities` |
| `GET /capabilities/:capabilityKey` | `GET /api/v1/capabilities/:capabilityKey` |
| `PATCH /capabilities/:capabilityKey/state` | `PATCH /api/v1/capabilities/:capabilityKey/state` |
| `GET /capabilities/:capabilityKey/history` | `GET /api/v1/capabilities/:capabilityKey/history` |
| `GET /capabilities/:capabilityKey/trust` | `GET /api/v1/capabilities/:capabilityKey/trust` |
| `POST /capabilities/:capabilityKey/recompute` | `POST /api/v1/capabilities/:capabilityKey/recompute` |
| Extra (not in short list) | `GET .../evaluate`, `GET .../behavior`, `POST .../activate-if-ready` |

**Permissions**

| Pack | Repo |
|------|------|
| `GET /permissions` | `GET /api/v1/permissions` |
| `POST /permissions/request` | `POST /api/v1/permissions/request` |
| `PATCH /permissions/:id` | `PATCH /api/v1/permissions/:id` |
| `GET /permissions/purpose-catalog` | **Added** — static catalog for purpose‑based UX |

**Surfaces**

| Pack | Repo |
|------|------|
| `GET /surfaces/policies` | **`GET /api/v1/surfaces/policies`** (alias) and existing `GET /api/v1/surface-policies` |
| `PATCH /surfaces/policies/:surfaceType` | **Gap:** pack suggests patch by `surfaceType`; repo patches **`PATCH /api/v1/surface-policies/:id`** (by row id). *Future:* add patch by `surfaceType` or document id‑based flow only |

**Language / voice**

| Pack | Repo |
|------|------|
| `GET /languages`, `GET /languages/:tag`, `.../capabilities` | Implemented |
| `GET/ PATCH /settings/language` | Implemented |
| `GET /voice/capabilities`, `GET /voice/voices` | Implemented |

**Audit / explainability**

| Pack | Repo |
|------|------|
| `GET /capabilities/:capabilityKey/explanation` | **Gap** — use `GET /capabilities/:key` + catalog + or add dedicated endpoint |
| `GET /audit/capability-activations` | **Gap** — use **`/capabilities/:key/history`** or add `AuditLog` filter by type |

---

## 5. UI mapping (pack §8 → web)

| Pack screen | Repo |
|-------------|------|
| **Capability Center** | `/capabilities` — `Capabilities.tsx`: onboarding hints + registry table + state select |
| **Permission by Purpose** | Partially via **hints** + catalog; **no dedicated full‑page flow** yet |
| **Surface Privacy** | **Settings** + `GET /surface-policies` (assistant mediation section); **no dedicated `/surface-privacy` page** |
| **Language & Voice** | **Settings** → `LanguageVoiceSection` |
| **Capability Detail** | **Gap** — no `/capabilities/:key` route; **detail** available via API only |

**UX pack §9–10:** Replace internal enum strings in tables with **plain labels** everywhere (some i18n exists; expand for trust/readiness).

---

## 6. “Do not build now” (pack §4) — still enforced

No full geo inference engine, full user‑state engine, full routine scaffolding, watch app, tile runtime, or **full speech pipeline** in this milestone. Scaffolds and APIs may exist; **control plane** is the focus.

---

## 7. Recommended completion order (adapted)

1. **Harden Capability Center UX** — grouped sections (not enabled / passive / active), plain‑language labels, **detail** link or `/capabilities/:key` page.
2. **Purpose permission flow** — wire `GET /permissions/purpose-catalog` + `POST /permissions/request` into a short wizard or expanded cards.
3. **Surface privacy** — dedicated surface or expand Settings; optional **`PATCH` by `surfaceType`**.
4. **Audit** — `GET /audit/capability-activations` or document using **`history`** + `AuditLog`.
5. **Permission status enum** — optional migration if `REQUESTED` / `DENIED` needed beyond `granted` + `revokedAt`.

---

## 8. Completion checklist (pack §14, adapted)

| # | Criterion | Repo |
|---|-----------|------|
| 1 | Open Capability Center | `/capabilities` |
| 2 | See what Life OS can do | Hints + registry + catalog labels |
| 3 | Purpose‑based permission | API + hints; **full UI flow TBD** |
| 4 | States not_enabled / passive / active | Yes |
| 5 | Surface policies | Yes (by id); **alias** `GET /surfaces/policies` |
| 6 | Language/voice by modality | Settings → Language & voice |
| 7 | Downgrade/revoke | State select + permission patch |
| 8 | No silent over‑expansion | Behavior + activation services + mediation |

---

## 9. Reference

- Blueprint pack (execution): `Life_OS_Full_Phases_0_7_Blueprint_Pack/09_CURSOR_MASTER_EXECUTION_RULES.md`
- Scope: `docs/NEXT_PHASE_SCOPE.md`
- Global language notes: `docs/GLOBAL_INCLUSIVE_PRODUCT.md`
