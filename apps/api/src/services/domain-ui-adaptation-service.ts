import { prisma } from '@life-os/database';
import { ensureUserDomainProfiles } from './adaptive-domain-service.js';

export type UiAdaptationHints = {
  /** Brief / list density */
  contentDensity: 'low' | 'normal';
  /** Emphasize these sections in UI copy */
  emphasis: string[];
  /** Prefer simpler wording */
  simplerExplanations: boolean;
  /** Lower interruption / fewer prompts */
  lowerInterruption: boolean;
};

/** Drive UI density and emphasis from active domains (no identity labels). */
export async function getUiAdaptationHints(userId: string): Promise<UiAdaptationHints> {
  await ensureUserDomainProfiles(userId);
  const profiles = await prisma.userDomainProfile.findMany({
    where: { userId, runtimeState: 'active' },
  });
  const keys = new Set(profiles.map((p) => p.domainKey));

  const emphasis: string[] = [];
  if (keys.has('follow_through')) emphasis.push('obligations', 'brief');
  if (keys.has('context_prep')) emphasis.push('events', 'people');
  if (keys.has('personal_admin')) emphasis.push('admin', 'renewals');
  if (keys.has('learning_support')) emphasis.push('study_structure');
  if (keys.has('wellbeing_support')) emphasis.push('pace', 'recovery');
  if (keys.has('relationship_support')) emphasis.push('people', 'follow_up');

  let simplerExplanations =
    keys.has('wellbeing_support') || keys.has('learning_support') || keys.has('routine_scaffolding');
  let lowerInterruption = keys.has('wellbeing_support');
  let contentDensity: 'low' | 'normal' = 'normal';

  if (keys.has('wellbeing_support') || profiles.some((p) => p.activationStrength === 'low')) {
    contentDensity = 'low';
    lowerInterruption = true;
  }

  return {
    contentDensity,
    emphasis,
    simplerExplanations,
    lowerInterruption,
  };
}
