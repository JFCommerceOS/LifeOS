import { prisma } from '@life-os/database';
import type { DomainRuntimeState } from '@prisma/client';
import { writeAudit } from '../lib/audit.js';
import { ensureUserDomainProfiles } from './adaptive-domain-service.js';

export async function patchUserDomainProfile(
  userId: string,
  domainKey: string,
  patch: {
    runtimeState?: DomainRuntimeState;
    activationStrength?: 'low' | 'medium' | 'high';
    confidence?: number;
    sourceSignalsJson?: string;
  },
  triggeredBy: string,
  reasonSummary?: string,
) {
  await ensureUserDomainProfiles(userId);
  const prev = await prisma.userDomainProfile.findUnique({
    where: { userId_domainKey: { userId, domainKey } },
  });
  if (!prev) throw new Error('DOMAIN_NOT_FOUND');

  const updated = await prisma.userDomainProfile.update({
    where: { userId_domainKey: { userId, domainKey } },
    data: {
      ...(patch.runtimeState !== undefined ? { runtimeState: patch.runtimeState } : {}),
      ...(patch.activationStrength !== undefined ? { activationStrength: patch.activationStrength } : {}),
      ...(patch.confidence !== undefined ? { confidence: patch.confidence } : {}),
      ...(patch.sourceSignalsJson !== undefined ? { sourceSignalsJson: patch.sourceSignalsJson } : {}),
    },
  });

  if (patch.runtimeState !== undefined && patch.runtimeState !== prev.runtimeState) {
    await prisma.domainActivationEvent.create({
      data: {
        userId,
        domainKey,
        previousState: prev.runtimeState,
        newState: patch.runtimeState,
        reasonSummary: reasonSummary ?? `Domain state set to ${patch.runtimeState}`,
        triggeredBy,
      },
    });
    await writeAudit(userId, 'domain.state', {
      entityType: 'Domain',
      entityId: domainKey,
      meta: { previousState: prev.runtimeState, newState: patch.runtimeState, triggeredBy },
    });
  }

  return updated;
}
