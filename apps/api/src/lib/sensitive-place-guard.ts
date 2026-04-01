import type { PlaceSensitivity } from '@prisma/client';

/** Event + optional catalog row for pattern/insight surfaces (metadata-only paths). */
export type PlaceInsightEventShape = {
  masked: boolean;
  savedPlace: {
    sensitivity: PlaceSensitivity;
    defaultMasked: boolean;
  } | null;
};

/**
 * When true, omit from aggregated place insights (counts, “recent labels”, twin traits)
 * so sensitive / user-masked visits are not surfaced in narrative summaries.
 */
export function placeEventExcludedFromPatternInsights(event: PlaceInsightEventShape): boolean {
  if (event.masked) return true;
  const sp = event.savedPlace;
  if (!sp) return false;
  if (sp.defaultMasked) return true;
  if (sp.sensitivity === 'private_sensitive') return true;
  return false;
}
