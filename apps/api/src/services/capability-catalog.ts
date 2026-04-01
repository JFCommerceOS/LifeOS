/** Static capability catalog — keys, defaults, purpose copy (permission-by-purpose). */
import type { CapabilityRuntimeState } from '@prisma/client';

export type CapabilityCatalogEntry = {
  capabilityKey: string;
  defaultRuntimeState: CapabilityRuntimeState;
  defaultActivationLevel: number;
  defaultSensitivityClass: number;
  dataSourcesRequired: string[];
  permissionScopeRequired: string[];
  purposeLabel: string;
  explanationTemplate: string;
  defaultAllowedBehaviors: string[];
  defaultBlockedBehaviors: string[];
};

export const CAPABILITY_DEFINITIONS: CapabilityCatalogEntry[] = [
  {
    capabilityKey: 'follow_through_core',
    defaultRuntimeState: 'active',
    defaultActivationLevel: 1,
    defaultSensitivityClass: 0,
    dataSourcesRequired: ['notes', 'tasks', 'calendar'],
    permissionScopeRequired: ['local_storage'],
    purposeLabel: 'Follow-through and daily brief',
    explanationTemplate:
      'Core reminders, obligations, and brief. Low assertiveness; no deep personal claims.',
    defaultAllowedBehaviors: ['remind', 'surface_brief', 'gentle_nudge'],
    defaultBlockedBehaviors: ['personality_claim', 'strong_predictive'],
  },
  {
    capabilityKey: 'context_prep',
    defaultRuntimeState: 'passive',
    defaultActivationLevel: 2,
    defaultSensitivityClass: 1,
    dataSourcesRequired: ['calendar', 'events'],
    permissionScopeRequired: ['calendar_read'],
    purposeLabel: 'Meeting and event context prep',
    explanationTemplate:
      'Prepares context before meetings. Unlocks after repeated value from the base system.',
    defaultAllowedBehaviors: ['prep_card', 'participant_summary'],
    defaultBlockedBehaviors: ['social_judgment', 'high_assertiveness'],
  },
  {
    capabilityKey: 'relationship_memory',
    defaultRuntimeState: 'passive',
    defaultActivationLevel: 2,
    defaultSensitivityClass: 1,
    dataSourcesRequired: ['people', 'conversations'],
    permissionScopeRequired: ['contacts_or_manual_people'],
    purposeLabel: 'Relationship continuity',
    explanationTemplate:
      'Remembers last interaction and supports follow-ups. Softer tone first; no deep personality claims.',
    defaultAllowedBehaviors: ['last_interaction', 'soft_follow_up_hint'],
    defaultBlockedBehaviors: ['personality_inference', 'loaded_social_judgment'],
  },
  {
    capabilityKey: 'geo_context',
    defaultRuntimeState: 'not_enabled',
    defaultActivationLevel: 3,
    defaultSensitivityClass: 1,
    dataSourcesRequired: ['location'],
    permissionScopeRequired: ['location_when_in_use'],
    purposeLabel: 'Realistic travel timing and errands',
    explanationTemplate:
      'Uses location for travel timing and errand grouping — not for lifestyle commentary at first.',
    defaultAllowedBehaviors: ['travel_timing', 'leave_by', 'errand_group'],
    defaultBlockedBehaviors: ['place_habit_commentary', 'social_pattern_claims'],
  },
  {
    capabilityKey: 'screen_time_support',
    defaultRuntimeState: 'not_enabled',
    defaultActivationLevel: 3,
    defaultSensitivityClass: 2,
    dataSourcesRequired: ['screen_time_summary'],
    permissionScopeRequired: ['screen_time'],
    purposeLabel: 'Overload-aware timing',
    explanationTemplate:
      'Adjusts reminder density from screen-time summaries — not for moralizing about habits.',
    defaultAllowedBehaviors: ['density_tune', 'overload_suppress'],
    defaultBlockedBehaviors: ['procrastination_label', 'health_moralizing'],
  },
  {
    capabilityKey: 'user_state_support',
    defaultRuntimeState: 'passive',
    defaultActivationLevel: 2,
    defaultSensitivityClass: 1,
    dataSourcesRequired: ['obligations', 'suggestions', 'profile'],
    permissionScopeRequired: ['internal'],
    purposeLabel: 'Attention and load inference',
    explanationTemplate: 'Heuristic user-state for mediation — explainable; no clinical claims.',
    defaultAllowedBehaviors: ['state_snapshot', 'mediation_input'],
    defaultBlockedBehaviors: ['burnout_diagnosis', 'clinical_claim'],
  },
  {
    capabilityKey: 'routine_scaffolding',
    defaultRuntimeState: 'passive',
    defaultActivationLevel: 3,
    defaultSensitivityClass: 1,
    dataSourcesRequired: ['routines', 'tasks'],
    permissionScopeRequired: ['internal'],
    purposeLabel: 'Non-punitive routine support',
    explanationTemplate: 'Gentle scaffolding — minimum success and recovery without guilt language.',
    defaultAllowedBehaviors: ['cadence_hint', 'recovery_suggest'],
    defaultBlockedBehaviors: ['streak_shame', 'punitive_copy'],
  },
  {
    capabilityKey: 'life_phase_transition',
    defaultRuntimeState: 'not_enabled',
    defaultActivationLevel: 4,
    defaultSensitivityClass: 3,
    dataSourcesRequired: ['patterns', 'obligations'],
    permissionScopeRequired: ['internal'],
    purposeLabel: 'Life-phase change support',
    explanationTemplate: 'Supportive transitions — high sensitivity; user control and corrections first.',
    defaultAllowedBehaviors: ['soft_check_in', 'optional_resource_hint'],
    defaultBlockedBehaviors: ['definitive_life_judgment', 'unsolicited_deep_analysis'],
  },
  {
    capabilityKey: 'surface_orchestration',
    defaultRuntimeState: 'passive',
    defaultActivationLevel: 3,
    defaultSensitivityClass: 1,
    dataSourcesRequired: ['devices'],
    permissionScopeRequired: ['internal'],
    purposeLabel: 'Per-surface delivery',
    explanationTemplate: 'Routes nudges to phone, watch, tile, or silent per policy.',
    defaultAllowedBehaviors: ['route_surface', 'respect_interruption_cap'],
    defaultBlockedBehaviors: ['bypass_privacy_mode'],
  },
  {
    capabilityKey: 'predictive_assistant_mode',
    defaultRuntimeState: 'not_enabled',
    defaultActivationLevel: 4,
    defaultSensitivityClass: 2,
    dataSourcesRequired: ['twin', 'decisions'],
    permissionScopeRequired: ['predictive_opt_in'],
    purposeLabel: 'Explainable adaptive planning',
    explanationTemplate: 'Digital-twin style cards — only after trust and opt-in; always explainable.',
    defaultAllowedBehaviors: ['adaptive_card', 'factor_breakdown'],
    defaultBlockedBehaviors: ['opaque_automation', 'unexplained_score'],
  },
];

export function getCatalogEntry(key: string): CapabilityCatalogEntry | undefined {
  return CAPABILITY_DEFINITIONS.find((c) => c.capabilityKey === key);
}
