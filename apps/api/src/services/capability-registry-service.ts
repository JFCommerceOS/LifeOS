import { prisma } from '@life-os/database';
import type { CapabilityRuntimeState } from '@prisma/client';
import { writeAudit } from '../lib/audit.js';
import { CAPABILITY_DEFINITIONS, getCatalogEntry } from './capability-catalog.js';

export async function ensureUserCapabilities(userId: string): Promise<void> {
  for (const def of CAPABILITY_DEFINITIONS) {
    await prisma.userCapabilityRegistry.upsert({
      where: {
        userId_capabilityKey: { userId, capabilityKey: def.capabilityKey },
      },
      create: {
        userId,
        capabilityKey: def.capabilityKey,
        runtimeState: def.defaultRuntimeState,
        activationLevel: def.defaultActivationLevel,
        trustScore: 0.22,
        sensitivityClass: def.defaultSensitivityClass,
        explanationTemplate: def.explanationTemplate,
      },
      update: {},
    });

    await prisma.capabilityBehaviorPolicy.upsert({
      where: {
        userId_capabilityKey: { userId, capabilityKey: def.capabilityKey },
      },
      create: {
        userId,
        capabilityKey: def.capabilityKey,
        allowedBehaviorsJson: JSON.stringify(def.defaultAllowedBehaviors),
        blockedBehaviorsJson: JSON.stringify(def.defaultBlockedBehaviors),
        confidenceThreshold: 0.55,
        trustThreshold: def.defaultActivationLevel >= 3 ? 0.45 : 0.35,
        surfacePolicyJson: '{}',
      },
      update: {},
    });

    await prisma.capabilityFeedbackMetrics.upsert({
      where: {
        userId_capabilityKey: { userId, capabilityKey: def.capabilityKey },
      },
      create: {
        userId,
        capabilityKey: def.capabilityKey,
      },
      update: {},
    });
  }
}

export async function listCapabilitiesForUser(userId: string) {
  await ensureUserCapabilities(userId);
  const rows = await prisma.userCapabilityRegistry.findMany({
    where: { userId },
    orderBy: { capabilityKey: 'asc' },
  });
  const metrics = await prisma.capabilityFeedbackMetrics.findMany({ where: { userId } });
  const mByKey = new Map(metrics.map((m) => [m.capabilityKey, m]));
  return rows.map((r) => {
    const def = getCatalogEntry(r.capabilityKey);
    return {
      ...r,
      catalog: def
        ? {
            purposeLabel: def.purposeLabel,
            dataSourcesRequired: def.dataSourcesRequired,
            permissionScopeRequired: def.permissionScopeRequired,
            defaultAllowedBehaviors: def.defaultAllowedBehaviors,
            defaultBlockedBehaviors: def.defaultBlockedBehaviors,
          }
        : null,
      metrics: mByKey.get(r.capabilityKey) ?? null,
    };
  });
}

export async function getCapabilityForUser(userId: string, capabilityKey: string) {
  await ensureUserCapabilities(userId);
  const row = await prisma.userCapabilityRegistry.findUnique({
    where: { userId_capabilityKey: { userId, capabilityKey } },
  });
  if (!row) return null;
  const [policy, metrics] = await Promise.all([
    prisma.capabilityBehaviorPolicy.findUnique({
      where: { userId_capabilityKey: { userId, capabilityKey } },
    }),
    prisma.capabilityFeedbackMetrics.findUnique({
      where: { userId_capabilityKey: { userId, capabilityKey } },
    }),
  ]);
  const def = getCatalogEntry(capabilityKey);
  return {
    registry: row,
    behaviorPolicy: policy,
    metrics,
    catalog: def,
  };
}

export async function patchCapabilityState(
  userId: string,
  capabilityKey: string,
  runtimeState: CapabilityRuntimeState,
  triggeredBy: string,
  reasonSummary?: string,
) {
  await ensureUserCapabilities(userId);
  const prev = await prisma.userCapabilityRegistry.findUnique({
    where: { userId_capabilityKey: { userId, capabilityKey } },
  });
  if (!prev) throw new Error('CAPABILITY_NOT_FOUND');

  const updated = await prisma.userCapabilityRegistry.update({
    where: { userId_capabilityKey: { userId, capabilityKey } },
    data: { runtimeState },
  });

  await prisma.capabilityActivationEvent.create({
    data: {
      userId,
      capabilityKey,
      previousState: prev.runtimeState,
      newState: runtimeState,
      reasonSummary: reasonSummary ?? `User or system set state to ${runtimeState}`,
      triggeredBy,
    },
  });

  await writeAudit(userId, 'capability.state', {
    entityType: 'Capability',
    entityId: capabilityKey,
    meta: { previousState: prev.runtimeState, newState: runtimeState, triggeredBy },
  });

  return updated;
}
