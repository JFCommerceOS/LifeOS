# Global & inclusive Life OS — product and engineering notes

This document captures the **strategic direction** and **implemented baseline** for a broad, international audience (students through retirees) without diluting the product spine: **Daily Brief**, **obligations**, **evidence/correction**, **local-first** privacy.

## Product positioning

- **One spine:** All personas use the same primitives (brief, obligations, capture) — not separate apps per role.
- **Tone:** Quiet continuity; avoid guilt-based productivity language and medical claims in UI copy.
- **Honest scope:** Market as **bounded follow-through + memory**, not open-ended AGI.

## Multilingual (implemented baseline)

- **Web:** `i18next` + `react-i18next` with locale JSON under [`apps/web/src/i18n/locales/`](../apps/web/src/i18n/locales/).
- **Nav language list:** Defined in [`apps/web/src/i18n/ui-locales.ts`](../apps/web/src/i18n/ui-locales.ts) (Tier‑1 set: `en`, `ar`, `ja`, `ko`, `th`, `vi`, `zh-Hans`, `zh-Hant`). The nav **intersects** that list with `GET /api/v1/languages` where `uiSupported` is true (falls back to the static list if the API is empty).
- **Full UI translations:** `en` + `ar` JSON bundles; other nav locales **reuse English strings** until a matching `locales/<code>.json` is added (see `usesEnglishStrings` in `ui-locales.ts`). Language persists in `localStorage` (`life-os:locale`).
- **RTL:** `document.documentElement.dir` follows [`ui-locales.ts`](../apps/web/src/i18n/ui-locales.ts) (`ar` RTL); prefer logical CSS (`end`/`start`) where layout is mirrored.
- **Dates/times:** UI uses [`Intl.DateTimeFormat`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat) via [`apps/web/src/lib/date.ts`](../apps/web/src/lib/date.ts); DB remains UTC (unchanged).

## API errors (stable codes)

- Fastify returns `{ error: { code, message } }` — see [`apps/web/src/lib/api.ts`](../apps/web/src/lib/api.ts) `ApiError` and [`apps/web/src/lib/format-api-error.ts`](../apps/web/src/lib/format-api-error.ts) for localized user-facing messages.
- Add new codes in API handlers and mirror keys under `errors.*` in locale files.

## Inclusive UX (ongoing)

- **Motion:** `prefers-reduced-motion` in [`apps/web/src/index.css`](../apps/web/src/index.css).
- **Contrast:** `prefers-contrast: more` hook for stronger legibility (light text-shadow baseline).
- **Tap targets / density:** Design tokens favor ≥44px where specified; optional “simple vs detail” density is a future enhancement.
- **Filter heuristics:** Obligation filters still use **English-biased keywords**; long-term: locale-aware lists or user-configurable keywords with explicit opt-in for any ML.

## Next steps (out of current baseline)

- Additional locales (ES, FR, …) via new JSON files + `resources` in [`apps/web/src/i18n/config.ts`](../apps/web/src/i18n/config.ts).
- WCAG audit pass on key flows.
- Server-side `Accept-Language` or user profile field for default locale on first visit.

See also [`docs/NEXT_PHASE_SCOPE.md`](NEXT_PHASE_SCOPE.md) and blueprint pack execution rules.
