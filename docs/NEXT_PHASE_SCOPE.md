# Next implementation scope (no overlap)

## Current state

- **Phases 0–7** — Blueprint pack [`Life_OS_Full_Phases_0_7_Blueprint_Pack`](../Life_OS_Full_Phases_0_7_Blueprint_Pack/) is **implemented at a baseline** in this repo: foundation through **edge ecosystem** (`EdgeDevice`, `/ecosystem/manifest`, `/companion/watch`, device sync intent flags). Iterate toward acceptance per phase docs as needed.

## Active focus

- **Hardening & acceptance** — Close gaps vs each phase’s acceptance criteria; add tests and UX polish where the blueprint requires it. Quick manual bar: [`PHASE_0_1_ACCEPTANCE_CHECKLIST.md`](./PHASE_0_1_ACCEPTANCE_CHECKLIST.md).
- **Recent:** daily brief populates **`before_meeting`** / **`watch_week`** when data exists; web **Suggestions** page for dismiss/snooze/false positive; Brief links to events and suggestions.
- **Ambient desk tile (product blueprint):** Continuity core in-repo is **API + DB**; phone remains the **target** primary runtime. **`GET /surfaces/tile/current`** returns redacted **`TileDisplayModel`**; see [`AGENTS.md`](../AGENTS.md) §Locked product truths.
- **No new numbered phase** until product defines **Phase 8+** scope outside this pack.

## Cross-cutting platform hardening (blueprint)

Incremental **trust / policy / sync** work aligned with `Life_OS_Cross_Cutting_System_Architecture_Hardening_Blueprint.md` (external). Does not replace the product roadmap.

- **Phase A delta vs this repo:** [`HARDENING_PHASE_A_DELTA.md`](./HARDENING_PHASE_A_DELTA.md)
- **Interim single-writer sync (until mutation log):** [`SYNC_SINGLE_WRITER_INVARIANTS.md`](./SYNC_SINGLE_WRITER_INVARIANTS.md)

## Post-baseline expansion (Sprints 13–21)

Product roadmap after the 0–7 baseline is captured in **`Life_OS_Sprint_13_to_21_Master_Expansion_Pack.md`** (location → behavior → … → readout). Treat that document as the **ordered backlog**; implement **one sprint at a time** with its gate.

- **Roadmap pointer + execution order:** [`docs/roadmap/SPRINTS_13_21_POINTER.md`](./roadmap/SPRINTS_13_21_POINTER.md) — copy or symlink the master pack into `docs/roadmap/` if you want a single in-repo path for the full spec.
- **Sprint 13 — inventory (PlaceEvent vs pack):** [`docs/SPRINT_13_LOCATION_INTAKE_DELTA.md`](./SPRINT_13_LOCATION_INTAKE_DELTA.md)
- **Sprints 14–20 — context modifiers (no core-ingestion hardwires):** [`docs/EXPANSION_SPRINTS_SIGNAL_GRAPH.md`](./EXPANSION_SPRINTS_SIGNAL_GRAPH.md)
- **Sprint 21 — TTS/readout extends Sprint 12:** [`docs/SPRINT_21_READOUT_EXTENSION.md`](./SPRINT_21_READOUT_EXTENSION.md)

## Alignment

[`09_CURSOR_MASTER_EXECUTION_RULES.md`](../Life_OS_Full_Phases_0_7_Blueprint_Pack/09_CURSOR_MASTER_EXECUTION_RULES.md): local-first; opt-ins default **off** where specified; watch/accessory surfaces stay **minimal**; no mandatory cloud.

## Global / inclusive (i18n, RTL, accessibility)

Product + engineering notes: [`GLOBAL_INCLUSIVE_PRODUCT.md`](./GLOBAL_INCLUSIVE_PRODUCT.md) — web `en` + `ar` baseline, `Intl` dates, API error code mapping, contrast/motion hooks.

## Overlap guardrails

1. **Companion / export** — thin slices; expand device sync only with explicit scope (encryption, conflict rules, module mapping).
2. **`EntityLink`** — reuse for graph edges.
3. **`UserSettings`** — additive; **`deviceSyncOptIn`** defaults **false**.

Phase 1 gap notes (historical): [`PHASE_1_GAP_ANALYSIS.md`](./PHASE_1_GAP_ANALYSIS.md).
