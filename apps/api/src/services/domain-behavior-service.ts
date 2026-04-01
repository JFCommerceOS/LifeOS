import { prisma } from '@life-os/database';
import { ensureUserDomainProfiles } from './adaptive-domain-service.js';

/** Guardrail: domain + user policy + runtime state. */
export async function isDomainBehaviorAllowed(
  userId: string,
  domainKey: string,
  behaviorKey: string,
): Promise<{ allowed: boolean; reason: string }> {
  await ensureUserDomainProfiles(userId);
  const catalog = await prisma.assistantDomain.findUnique({ where: { domainKey } });
  const profile = await prisma.userDomainProfile.findUnique({
    where: { userId_domainKey: { userId, domainKey } },
  });
  const policy = await prisma.domainBehaviorPolicy.findUnique({
    where: { userId_domainKey: { userId, domainKey } },
  });
  if (!catalog || !profile || !policy) {
    return { allowed: false, reason: 'missing_domain_or_profile' };
  }

  if (profile.runtimeState === 'not_active') {
    return { allowed: false, reason: 'domain_not_active' };
  }
  if (profile.runtimeState === 'restricted') {
    const okRestricted = ['observe', 'internal_score', 'suppress_surface'].includes(behaviorKey);
    if (!okRestricted) {
      return { allowed: false, reason: 'domain_restricted' };
    }
  }
  if (profile.runtimeState === 'passive') {
    const passiveOk = new Set([
      'observe',
      'index',
      'prepare',
      'score_internal',
      'prep_summary',
      'gentler_pacing',
    ]);
    if (!passiveOk.has(behaviorKey)) {
      return { allowed: false, reason: 'passive_domain_internal_only' };
    }
  }

  const globalBlocked: string[] = JSON.parse(catalog.blockedBehaviorsJson || '[]') as string[];
  if (globalBlocked.includes(behaviorKey)) {
    return { allowed: false, reason: 'blocked_by_catalog' };
  }
  const userBlocked: string[] = JSON.parse(policy.blockedBehaviorsJson || '[]') as string[];
  if (userBlocked.includes(behaviorKey)) {
    return { allowed: false, reason: 'blocked_by_user_policy' };
  }

  const userAllowed: string[] = JSON.parse(policy.allowedBehaviorsJson || '[]') as string[];
  if (userAllowed.length && !userAllowed.includes(behaviorKey)) {
    return { allowed: false, reason: 'not_in_allowed_behaviors' };
  }

  return { allowed: true, reason: 'ok' };
}
