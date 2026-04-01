# Everyone Mode Spec (v1)

This spec defines a beginner-first product layer on top of the current Life OS architecture.

## Goals

- Reduce first-week cognitive load for mainstream users.
- Keep the existing continuity core intact (`capture -> signals -> obligations/suggestions -> daily brief`).
- Preserve privacy/trust posture (optional signals off by default; no hidden tracking).

## Architecture Mapping

### Existing Core (unchanged)

- API + Postgres continuity core.
- Signal processing and obligation/suggestion generation.
- Daily Brief as primary action surface.

### New Settings Contract

`UserSettings` additions:

- `everyoneModeEnabled: boolean` (default `true`)
- `onboardingCompletedAt: DateTime?`

Rationale: these are user-level presentation/onboarding controls, not model-inference toggles.

## Onboarding Flow (v1)

Route: `/welcome`

1. **Core mode**  
   Toggle `everyoneModeEnabled`.
2. **Optional signals**  
   Select opt-ins for:
   - `patternSignalsOptIn`
   - `locationIntelligenceOptIn`
   - `lifestyleInsightsOptIn`
3. **Complete**  
   Set `onboardingCompletedAt` to `now`.

## Default UI in Everyone Mode

### Primary / More Nav behavior

Keep defaults focused:

- Primary: Brief, Obligations, Capture, Privacy, Settings
- More menu (reduced): Notes, Suggestions, Voice, Places, Settings

Advanced destinations remain available when `everyoneModeEnabled=false`.

### Hidden/De-emphasized modules in v1

When `everyoneModeEnabled=true`, de-emphasize:

- Twin / Co-pilot
- Domains / Capabilities
- Ecosystem / Tile
- Connector-heavy admin surfaces

(Current v1 implementation does this through navigation visibility first; deeper per-page gating can be added incrementally.)

## Success Metrics

Track weekly:

1. **Onboarding completion rate**  
   `% users with onboardingCompletedAt set within 24h of first session`.
2. **Time-to-first-value**  
   Median time from first session to first completed obligation.
3. **Core adherence**  
   Share of sessions using Brief/Capture/Obligations vs advanced routes.
4. **Noise proxy**  
   Suggestion dismiss rate after onboarding (lower is better if acceptance remains stable).
5. **Trust/agency proxy**  
   Correction + opt-out actions performed (users can shape the system without churn).

## Rollout Notes

- Launch with Everyone Mode enabled by default for new and existing users.
- Keep an explicit off-switch in Settings for power users.
- Do not couple Everyone Mode to LLM env controls (`LLM_ENABLED`, `ASFLC_ENABLED`).
