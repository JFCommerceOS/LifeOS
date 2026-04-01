/** Ambient desk tile — calm, redacted, non-archive surface (Device Architecture blueprint). */

export type TileMode =
  | 'calm_brief'
  | 'focus'
  | 'meeting'
  | 'admin'
  | 'private_minimal'
  | 'evening_carryover';

export type TilePrivacyClass = 'standard' | 'redacted' | 'minimal';

export type TileActionHint =
  | 'open_phone_for_details'
  | 'tap_to_confirm'
  | 'voice_capture_available'
  | 'none';

export type TileUrgencyLevel = 'low' | 'normal' | 'elevated' | 'critical';

/** Compact display contract — built from continuity state, not raw records. */
export interface TileDisplayModel {
  mode: TileMode;
  primaryHeadline: string;
  primarySubline?: string;
  secondaryHeadline?: string;
  secondarySubline?: string;
  urgencyLevel: TileUrgencyLevel;
  privacyClass: TilePrivacyClass;
  actionHint: TileActionHint;
  lastUpdatedAt: string;
  /** Optional refs for handoff / actions (no sensitive payload). */
  ref?: {
    obligationId?: string;
    eventId?: string;
    suggestionId?: string;
    subscriptionId?: string;
  };
}

export const TILE_MODES_ORDER: TileMode[] = [
  'calm_brief',
  'focus',
  'meeting',
  'admin',
  'private_minimal',
  'evening_carryover',
];
