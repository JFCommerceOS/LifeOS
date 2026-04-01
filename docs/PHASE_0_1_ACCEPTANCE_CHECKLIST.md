# Phase 0–1 acceptance checklist

Use this to verify the **continuity + follow-through** core before treating Phase 0–1 as “done.”  
Aligned with the intent of external packs (e.g. Cursor master prompt for Phase 0–1); this repo may include later-phase routes — those are **out of scope** for this checklist.

## Environment

- [ ] `D:\LifeOS\.env` (or repo root `.env`) defines `DATABASE_URL`; API loads it via `apps/api/src/env.ts`.
- [ ] Postgres is reachable; `pnpm db:migrate` (or equivalent) applied.
- [ ] `pnpm dev` from repo root: web **5173**, API **3000**, Vite proxies `/api` → API.

## Core loop

- [ ] **Capture:** Notes save and appear under Capture.
- [ ] **Obligations:** Open obligations list; Done / Dismiss updates state.
- [ ] **Suggestions:** Pending suggestions list; dismiss / snooze / false positive work.
- [ ] **Daily Brief:** Loads from API; buckets visible when `pnpm brief:generate` (or engine) has run.
- [ ] **Brief ↔ suggestions:** After an action on a suggestion from the Brief, that row disappears on refresh (brief items removed server-side; see `removeDailyBriefItemsForSuggestion`).
- [ ] **Settings / privacy:** Settings and privacy toggles persist (smoke test).

## Trust / evidence (minimal bar)

- [ ] Suggestions show **reason** (and confidence where exposed).
- [ ] Event detail and obligation flows usable for drill-down (even if thin).

## Out of scope here

- Full detection quality, ranking sophistication, reminders CRUD, digital twin, tile/watch product surfaces — track separately.

## References

- Historical Phase 1 gap notes: [`PHASE_1_GAP_ANALYSIS.md`](./PHASE_1_GAP_ANALYSIS.md)
- Next scope: [`NEXT_PHASE_SCOPE.md`](./NEXT_PHASE_SCOPE.md)
