# Life OS — agent context

## Agent role lenses (recall first — all modes)

Before planning, answering, or coding, orient through these **predefined roles**: **senior system architect**; **SOP & workflow expert**; **AI agent / LLM developer**; **neural networks / ML** (when relevant); **psychologist** (social, developmental, cognitive, personality — trust, load, tone, behavior). Full text: `.cursor/rules/life-os-role-lenses.mdc`.

## Global / inclusive baseline

Web i18n (`en`, `ar` RTL pilot), `Intl` dates, localized API error messages, and a11y hooks are documented in [`docs/GLOBAL_INCLUSIVE_PRODUCT.md`](docs/GLOBAL_INCLUSIVE_PRODUCT.md).

## Locked product truths

1. **Life OS** is a **local-first personal continuity engine** (not a generic chatbot).
2. **Mac mini** is the primary **build** environment for this repo; phone is the future primary **runtime**; watch/accessories are **companion surfaces** with minimal payloads.
3. **Continuity core (today vs target):** This repo’s **continuity core** for development is the **API + PostgreSQL** process (see `continuityCore: 'server_api'` in [`apps/api/src/lib/ecosystem-manifest.ts`](apps/api/src/lib/ecosystem-manifest.ts)). Product vision still targets **phone-owned** local memory and ranking when the mobile runtime ships; **ambient tile / watch** clients consume **redacted `TileDisplayModel`** (and companion payloads) from that core over the network—never raw connector dumps. Tile does not bypass privacy or become a second brain.
4. **PCE** is the core platform; **FTE** (follow-through) is the first module; **CTX** then **ADM** follow in later phases.
5. Optional signals belong in the **Context Signals Layer** — never hardwire them into core ingestion in early phases.
6. **Privacy, evidence, and correction** are first-class: suggestions must be traceable; no silent scope expansion.
7. **External memory** (user-owned USB/NAS/disk + `pg_dump`) is preferred for backup; **cloud is not a Phase 0 dependency**.
8. **Product vs agent (locked):** Life OS is a **structured local-first continuity platform** with **agentic assistance inside it** — not a pure AI agent or chat shell. Canonical records, evidence, and correction stay primary; the agent interprets, mediates, explains, and assists. Full text: [`docs/LIFE_OS_PRODUCT_POSITIONING.md`](docs/LIFE_OS_PRODUCT_POSITIONING.md).

## Code conventions

- **Stack**: pnpm monorepo, Fastify + Zod + Prisma + PostgreSQL, Vite + React + Tailwind web.
- List APIs are **paginated**; companion/glance endpoints stay **small**.
- Do not commit `.env` or secrets.

## Blueprint pack (authoritative)

- `Life_OS_Full_Phases_0_7_Blueprint_Pack/09_CURSOR_MASTER_EXECUTION_RULES.md` — **read first**; strict phase order, no scope mixing.
- `Life_OS_Full_Phases_0_7_Blueprint_Pack/01_PHASE_0_FOUNDATION.md` — Phase 0 scope and API baseline.
- `Life_OS_Full_Phases_0_7_Blueprint_Pack/00_MASTER_LOCK_AND_VISION.md` — vision and locks.

Phase 0 baseline: see `docs/PHASE_0_ACCEPTANCE.md`.

## Active next scope (blueprint 0–7 baseline)

- **Phases 0–7** are **baselined** in-repo (see [`docs/NEXT_PHASE_SCOPE.md`](docs/NEXT_PHASE_SCOPE.md)): including **Phase 7** edge ecosystem ([`08_PHASE_7_EDGE_DEVICE_ECOSYSTEM.md`](Life_OS_Full_Phases_0_7_Blueprint_Pack/08_PHASE_7_EDGE_DEVICE_ECOSYSTEM.md)) — device registry, manifest, watch companion surface.
- **Next product work:** acceptance hardening and any **Phase 8+** scope defined outside the 0–7 pack.

## Phase gates

- **Phase 0 (done for this repo):** obligations, suggestions, daily brief, notes, connectors (stub sync), **source-records** ingestion API, audit, privacy/export stub — no ambient tracking, no full mailbox, no cloud-required sync.
- **Phase 1 (FTE baseline):** follow-through per `02` — keep improving toward acceptance.
- **Phase 2 (context):** Person/Conversation, entity links, context APIs.
- **Phase 3:** Admin Guard + voice capture + profile.
- **Phase 7 (edge ecosystem):** devices + watch-safe APIs — iterate to acceptance in `08`; no new numbered phase until product defines it.
