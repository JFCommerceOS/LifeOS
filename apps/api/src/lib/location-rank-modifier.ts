import { prisma } from '@life-os/database';

/**
 * Sprint 13 — modest rank nudge when location intelligence is on and recent non-sensitive visits exist.
 * Does not replace evidence; keeps multiplier near 1.
 */
export async function locationRankMultiplier(userId: string): Promise<number> {
  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  if (!settings?.locationIntelligenceOptIn) return 1;

  const since = new Date(Date.now() - 7 * 86400000);
  const n = await prisma.placeEvent.count({
    where: {
      userId,
      occurredAt: { gte: since },
      masked: false,
      OR: [
        { savedPlaceId: null },
        {
          savedPlace: {
            sensitivity: { in: ['normal', 'home', 'work'] },
            defaultMasked: false,
          },
        },
      ],
    },
  });
  if (n >= 3) return 1.01;
  return 1;
}
