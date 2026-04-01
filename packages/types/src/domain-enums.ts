/**
 * Sprint 01 / MVP contract enums — align with Prisma where models exist; otherwise
 * stable string unions for API + web without importing `@prisma/client` in UI.
 */

export const SIGNAL_TYPES = [
  'NOTE_CAPTURE',
  'CALENDAR_EVENT',
  'TASK_ITEM',
  'DOCUMENT_INPUT',
  'REMINDER_INPUT',
  'CORRECTION_INPUT',
  'ROUTINE_GOAL',
  'PLACE_EVENT',
  'SCREEN_TIME_SUMMARY',
  'VOICE_CAPTURE',
  'RELATIONSHIP_SIGNAL',
  'LANGUAGE_PREFERENCE_SIGNAL',
  'SURFACE_INTERACTION_SIGNAL',
] as const;
export type SignalType = (typeof SIGNAL_TYPES)[number];

/** `ExtractedFact.factType` is a string in DB; these are common normalized keys. */
export const FACT_TYPES = [
  'deadline',
  'follow_up',
  'commitment',
  'person_mention',
  'place_mention',
  'task_candidate',
] as const;
export type FactType = (typeof FACT_TYPES)[number];

/** Obligation is not typed in DB; used in DTOs / heuristics for surfacing. */
export const OBLIGATION_TYPES = ['follow_up', 'deadline', 'review', 'commitment', 'other'] as const;
export type ObligationType = (typeof OBLIGATION_TYPES)[number];

export const OBLIGATION_STATUSES = ['open', 'done', 'dismissed'] as const;
export type ObligationStatus = (typeof OBLIGATION_STATUSES)[number];

export const SUGGESTION_TYPES = ['pattern', 'connector', 'calendar', 'manual', 'other'] as const;
export type SuggestionType = (typeof SUGGESTION_TYPES)[number];

/** Mirrors Prisma `SuggestionState`. */
export const SUGGESTION_STATUSES = ['pending', 'accepted', 'dismissed', 'snoozed', 'false_positive'] as const;
export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number];

/** Mirrors Prisma `MemoryLayerType` (Sprint “MemoryLayer”). */
export const MEMORY_LAYERS = ['hot_operational', 'warm_episodic', 'semantic', 'evidence', 'cold_archive'] as const;
export type MemoryLayer = (typeof MEMORY_LAYERS)[number];

export const DECISION_TYPES = ['life_admin', 'purchase', 'relationship', 'work', 'health', 'other'] as const;
export type DecisionType = (typeof DECISION_TYPES)[number];

export const FEEDBACK_TYPES = ['useful', 'not_useful', 'dismiss', 'snooze', 'comment'] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];
