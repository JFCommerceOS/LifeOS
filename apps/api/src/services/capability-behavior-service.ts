import { prisma } from '@life-os/database';
import { ensureUserCapabilities } from './capability-registry-service.js';

/** Whether a behavior is allowed given registry + policy + runtime state (not_enabled → nothing user-facing). */
export async function isBehaviorAllowed(
  userId: string,
  capabilityKey: string,
  behaviorKey: string,
): Promise<{ allowed: boolean; reason: string }> {
  await ensureUserCapabilities(userId);
  const registry = await prisma.userCapabilityRegistry.findUnique({
    where: { userId_capabilityKey: { userId, capabilityKey } },
  });
  const policy = await prisma.capabilityBehaviorPolicy.findUnique({
    where: { userId_capabilityKey: { userId, capabilityKey } },
  });
  if (!registry || !policy) {
    return { allowed: false, reason: 'missing_registry_or_policy' };
  }
  if (registry.runtimeState === 'not_enabled') {
    return { allowed: false, reason: 'capability_not_enabled' };
  }
  if (registry.runtimeState === 'passive') {
    const passiveOk = new Set([
      'observe',
      'index',
      'prepare',
      'score_internal',
      'state_snapshot',
      'mediation_input',
      'density_tune',
      'overload_suppress',
    ]);
    if (!passiveOk.has(behaviorKey)) {
      return { allowed: false, reason: 'passive_only_internal_observation' };
    }
  }
  const blocked: string[] = JSON.parse(policy.blockedBehaviorsJson || '[]') as string[];
  if (blocked.includes(behaviorKey)) {
    return { allowed: false, reason: 'blocked_by_policy' };
  }
  const allowed: string[] = JSON.parse(policy.allowedBehaviorsJson || '[]') as string[];
  if (allowed.length && !allowed.includes(behaviorKey)) {
    return { allowed: false, reason: 'not_in_allowed_list' };
  }
  return { allowed: true, reason: 'ok' };
}
