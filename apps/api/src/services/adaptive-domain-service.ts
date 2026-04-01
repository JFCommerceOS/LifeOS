import { prisma } from '@life-os/database';
import { defaultForDomain } from './domain-catalog.js';

/** Ensure per-user rows exist for every catalog domain. */
export async function ensureUserDomainProfiles(userId: string): Promise<void> {
  const catalog = await prisma.assistantDomain.findMany({ orderBy: { domainKey: 'asc' } });
  for (const d of catalog) {
    const def = defaultForDomain(d.domainKey);
    await prisma.userDomainProfile.upsert({
      where: { userId_domainKey: { userId, domainKey: d.domainKey } },
      create: {
        userId,
        domainKey: d.domainKey,
        runtimeState: def.runtimeState,
        activationStrength: def.activationStrength,
        confidence: def.confidence,
        sourceSignalsJson: '{}',
      },
      update: {},
    });

    await prisma.domainBehaviorPolicy.upsert({
      where: { userId_domainKey: { userId, domainKey: d.domainKey } },
      create: {
        userId,
        domainKey: d.domainKey,
        allowedBehaviorsJson: d.allowedBehaviorsJson,
        blockedBehaviorsJson: d.blockedBehaviorsJson,
        maxAssertivenessLevel: d.sensitivityClass >= 2 ? 2 : 3,
        maxSurfaceScope: 'phone_watch_tile',
        explanationTemplate: d.description,
      },
      update: {},
    });

    await prisma.domainFeedbackMetrics.upsert({
      where: { userId_domainKey: { userId, domainKey: d.domainKey } },
      create: { userId, domainKey: d.domainKey },
      update: {},
    });
  }
}

export async function listDomainCatalog() {
  return prisma.assistantDomain.findMany({ orderBy: { domainKey: 'asc' } });
}

export async function getDomainCatalogEntry(domainKey: string) {
  return prisma.assistantDomain.findUnique({ where: { domainKey } });
}

/** Merged view: catalog + user profile + metrics + policy. */
export async function listUserDomainProfile(userId: string) {
  await ensureUserDomainProfiles(userId);
  const catalog = await prisma.assistantDomain.findMany({ orderBy: { domainKey: 'asc' } });
  const profiles = await prisma.userDomainProfile.findMany({ where: { userId } });
  const metrics = await prisma.domainFeedbackMetrics.findMany({ where: { userId } });
  const policies = await prisma.domainBehaviorPolicy.findMany({ where: { userId } });
  const pByKey = new Map(profiles.map((x) => [x.domainKey, x]));
  const mByKey = new Map(metrics.map((x) => [x.domainKey, x]));
  const polByKey = new Map(policies.map((x) => [x.domainKey, x]));

  return catalog.map((c) => ({
    catalog: c,
    profile: pByKey.get(c.domainKey) ?? null,
    metrics: mByKey.get(c.domainKey) ?? null,
    behaviorPolicy: polByKey.get(c.domainKey) ?? null,
  }));
}

export async function getUserDomainDetail(userId: string, domainKey: string) {
  await ensureUserDomainProfiles(userId);
  const catalog = await prisma.assistantDomain.findUnique({ where: { domainKey } });
  if (!catalog) return null;
  const [profile, metrics, behaviorPolicy] = await Promise.all([
    prisma.userDomainProfile.findUnique({ where: { userId_domainKey: { userId, domainKey } } }),
    prisma.domainFeedbackMetrics.findUnique({ where: { userId_domainKey: { userId, domainKey } } }),
    prisma.domainBehaviorPolicy.findUnique({ where: { userId_domainKey: { userId, domainKey } } }),
  ]);
  return { catalog, profile, metrics, behaviorPolicy };
}
