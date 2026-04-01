import type { DomainActivationStrength, DomainRuntimeState } from '@prisma/client';

/** Per-domain defaults when seeding user profiles (Phase A core → extended). */
export const DOMAIN_USER_DEFAULTS: Record<
  string,
  { runtimeState: DomainRuntimeState; activationStrength: DomainActivationStrength; confidence: number }
> = {
  follow_through: { runtimeState: 'active', activationStrength: 'high', confidence: 0.55 },
  context_prep: { runtimeState: 'active', activationStrength: 'medium', confidence: 0.5 },
  personal_admin: { runtimeState: 'passive', activationStrength: 'medium', confidence: 0.45 },
  learning_support: { runtimeState: 'not_active', activationStrength: 'low', confidence: 0.35 },
  wellbeing_support: { runtimeState: 'not_active', activationStrength: 'low', confidence: 0.35 },
  relationship_support: { runtimeState: 'passive', activationStrength: 'medium', confidence: 0.42 },
  work_support: { runtimeState: 'passive', activationStrength: 'medium', confidence: 0.42 },
  routine_scaffolding: { runtimeState: 'passive', activationStrength: 'low', confidence: 0.4 },
  geo_context_support: { runtimeState: 'not_active', activationStrength: 'low', confidence: 0.35 },
};

export function defaultForDomain(domainKey: string) {
  return (
    DOMAIN_USER_DEFAULTS[domainKey] ?? {
      runtimeState: 'not_active' as const,
      activationStrength: 'medium' as const,
      confidence: 0.4,
    }
  );
}
