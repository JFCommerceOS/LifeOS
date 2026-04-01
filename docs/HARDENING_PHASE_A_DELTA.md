# Hardening Phase A — concrete delta vs this repo

This document maps **Cross-Cutting System Architecture Hardening Blueprint §9 Phase A** (“Core trust foundation”: identity + device trust, encryption + key management, policy engine starter) to **existing** Life OS primitives so implementation extends the codebase instead of replacing it.

Blueprint reference: external `Life_OS_Cross_Cutting_System_Architecture_Hardening_Blueprint.md` §5.1, §5.2, §5.4, §9.

---

## 1. Identity and device trust (Layer A)

### Blueprint intent
- User identity, many devices, trust states (`pending`, `trusted`, `limited`, `revoked`), sessions, revocation, passkey-ready model, watch stricter defaults.

### Current repo baseline
| Primitive | Location | What it does today |
|-----------|----------|-------------------|
| Single-user continuity | [`apps/api/src/lib/user.ts`](../apps/api/src/lib/user.ts) | `ensureDefaultUser` + `getUserId()` — no multi-user auth. |
| Edge registration | [`packages/database/prisma/schema.prisma`](../packages/database/prisma/schema.prisma) `EdgeDevice` | `userId`, `clientDeviceId`, `label`, `role` (`phone` \| `watch` \| `accessory` \| `private_node`), `lastSeenAt`. |
| Device API | [`apps/api/src/routes/v1/devices.ts`](../apps/api/src/routes/v1/devices.ts) | `GET/POST /devices`, `POST /devices/register`, `PATCH/DELETE /devices/:id` + optional `notificationRegistration`. |
| Audit | [`apps/api/src/lib/audit.ts`](../apps/api/src/lib/audit.ts) | `device.register`, `device.patch`, `device.delete`. |

### Concrete deltas (incremental)
1. **Trust state** — Add `EdgeDeviceTrustState` (or string enum on `EdgeDevice`): `pending | trusted | limited | revoked`. Default `trusted` for backward compatibility with existing rows.
2. **Revocation** — On `revoked`, reject API requests that identify the device (future: device-signed token); until then, block sync/push for revoked IDs in notification registration path.
3. **Session / passkey** — Defer passkeys and `SessionGrant` tables until product defines login UX; document placeholder in schema comments.
4. **Watch policy** — Tie “stricter display” to existing notification privacy / tile redaction ([`notification-lock-screen-render`](../apps/api/src/lib/notification-lock-screen-render.ts), surfaces tile); no duplicate policy stack.

---

## 2. Encryption and key management (Layer B)

### Blueprint intent
- Encrypted local stores, key hierarchy, encrypted export, secure purge for sensitive caches.

### Current repo baseline
| Primitive | Location | Notes |
|-----------|----------|--------|
| Data store | PostgreSQL via Prisma | Encryption at rest = deployment concern (disk/TDE). |
| Export | [`apps/api/src/routes/v1/export.ts`](../apps/api/src/routes/v1/export.ts), `ExportJob` | JSON/Markdown export with `includeSensitive` flag — not a wrapped encrypted bundle. |
| Retention / purge | Privacy + purge services | Class-based retention models exist. |

### Concrete deltas (incremental)
1. **App-level export encryption** — New export format or post-step: encrypt artifact with key derived from user-supplied passphrase (or device key when device trust ships); document recovery story in README.
2. **Field-level / column encryption** — Optional later; start with **export + backup path** only to avoid query complexity.
3. **Key tables** — Add `encryption_key_records` (blueprint §8) only when first consumer exists; avoid empty tables.

---

## 3. Policy engine starter (Layer D)

### Blueprint intent
- `PolicyRule` / `PolicyDecision`, permission-before-autonomy, auditable decisions per automated action.

### Current repo baseline
| Primitive | Location | Notes |
|-----------|----------|--------|
| User preferences | `NotificationUserPreference`, `UserSettings` | Per-category toggles, quiet hours. |
| Privacy | [`apps/api/src/routes/v1/privacy.ts`](../apps/api/src/routes/v1/privacy.ts) | Retention classes, actions, strict mode. |
| Capabilities / domains | Capability and domain services | Parallel “permission” concepts — converge toward policy decisions over time. |

### Implemented first slice (this PR)
- **`PolicyDecision` model** — Persists **allow/deny** with `reasonCodes` + JSON `context` for **`notification_delivery`** when [`syncNotificationFromMediation`](../apps/api/src/services/notification-from-mediation.ts) runs.
- **Read API** — `GET /api/v1/policy-decisions` (paginated) for inspection and future “why not” UI.

### Next deltas
1. Generalize `PolicySurfaceKind` (new surfaces: suggestion_rank, connector_sync, …).
2. Optional `PolicyRule` table or rules file versioned in repo; decisions reference rule keys.
3. Merge with capability/domain “allowed action” checks via shared `evaluatePolicy()` entry point.

---

## 4. Minimum viable Phase A checklist

Use this as acceptance for “Phase A started” (not all of Layer B at once):

- [x] Documented mapping (this file).
- [x] Policy decision persistence for one automation class (notification delivery).
- [ ] Edge device trust enum + API fields (optional follow-up).
- [ ] Encrypted export path (optional follow-up; blueprint Layer B).

---

## 5. References

- Product scope: [`docs/NEXT_PHASE_SCOPE.md`](NEXT_PHASE_SCOPE.md)
- Single-writer sync deferral: [`docs/SYNC_SINGLE_WRITER_INVARIANTS.md`](SYNC_SINGLE_WRITER_INVARIANTS.md)
