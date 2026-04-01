# Sprint 21 — Text-to-speech / readout: extend Sprint 12, do not fork

This document **plans** Sprint 21 as a **strict extension** of existing voice/readout work so there is **one** readout abstraction in the codebase.

**Pack reference:** `Life_OS_Sprint_13_to_21_Master_Expansion_Pack.md` § Sprint 21.  
**Prior work:** Sprint 12 stubs documented in repo (`spokenReadoutEnabled`, brief/suggestion readout HTTP stubs).

## Current baseline (Sprint 12 — do not duplicate)

| Piece | Location | Role |
| ----- | -------- | ---- |
| User toggle | `UserSettings.spokenReadoutEnabled` in [`schema.prisma`](../packages/database/prisma/schema.prisma) | Global opt-in for spoken output |
| HTTP stubs | `POST /api/v1/briefs/today/readout`, `POST /api/v1/suggestions/:id/readout` in [`briefs.ts`](../apps/api/src/routes/v1/briefs.ts), [`suggestions.ts`](../apps/api/src/routes/v1/suggestions.ts) | Return **script text** + `audioBase64: null` |
| Speech readout service reads brief/suggestions | [`apps/api/src/services/speech-readout-service.ts`](../apps/api/src/services/speech-readout-service.ts) | Single place to assemble **strings** for TTS |
| Language / TTS routing (providers) | [`language-stack`](../apps/api/src/services/language-stack.ts), [`voice.ts`](../apps/api/src/routes/v1/voice.ts) capabilities | Provider selection for future real synthesis |

**Rule:** New Sprint 21 code should call into **the same service module** (or split **subfiles** under `services/speech/` re-exported from `speech-readout-service.ts`) — not a parallel `SpeechReadoutServiceV2`.

## Pack gap (what Sprint 21 adds incrementally)

| Pack item | Baseline today | Extension plan |
| --------- | -------------- | -------------- |
| `TextToSpeechService` | `routeTts` + stub responses | Implement **`synthesizeReadoutText(userId, text, context)`** in one module; call from readout routes when `LLM`/provider configured; keep **stub return** when not |
| `ReadoutFormattingService` | Brief titles joined in `buildDailyBriefReadout` | Extract **formatter** functions (max length, bucket ordering, “do now” emphasis) — pure functions + tests |
| `ReadoutPrivacyGuardService` | Not present | Before synth: **redact** items using tile/privacy rules (reuse [`privacy-redaction`](../apps/api/src/lib/privacy-redaction.ts) or `TileDisplayModel` redaction helpers); **suppress** financial/health-sensitive phrases on lock / companion |
| `VoiceSummaryStyleSettings` | Only global boolean | Add **`UserSettings`** JSON or columns: e.g. `readoutVerbosity`, `readoutMaxItems` — **additive migration** |
| `readout_jobs` / `readout_history` / `speech_profiles` | Not present | **Optional phase:** job queue for long synthesis; history for audit; profiles map to **`SupportedLanguage` / provider policies** — only if product needs async; otherwise keep **synchronous stub** |
| `speech_assets_cache` | Not present | File or blob cache of synthesized chunks — **later**; avoid second cache next to voice audio under `data/voice/` |

## UI / client

- **Mobile / web:** “Speak this card” should hit **existing** readout endpoints with optional `itemId` query/body extension — **extend** contracts rather than new `/readout/v2` paths.
- **Accessibility:** Prefer **Web Speech API** or OS TTS on client when `audioBase64` is null (document in API response `note` field — already hints at this).

## Testing

- **Unit:** `ReadoutPrivacyGuardService` — sensitive brief lines → redacted or omitted script.
- **Unit:** formatter — max length, calm tone (no guilt strings).
- **Integration:** `spokenReadoutEnabled: false` → **403 or disabled payload** consistent across brief + suggestion readout.
- **Manual:** no microphone activation on readout-only flows (pack § Sprint 21).

## Dependency order

Sprint 21 should land **after** brief/suggestion surfaces are stable. It **reuses** Sprint 12 settings and routes; add schema for jobs/history **only** after synchronous TTS path is proven.

## Related

- Cross-sprint ranking (no readout in ingestion): [`EXPANSION_SPRINTS_SIGNAL_GRAPH.md`](./EXPANSION_SPRINTS_SIGNAL_GRAPH.md)
- Roadmap pointer: [`docs/roadmap/SPRINTS_13_21_POINTER.md`](./roadmap/SPRINTS_13_21_POINTER.md)
