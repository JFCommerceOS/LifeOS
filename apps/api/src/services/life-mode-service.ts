import type { MainLifeMode } from '@prisma/client';
import { prisma } from '@life-os/database';

const MANUAL = 'manual';

export async function getActiveManualMode(userId: string): Promise<{
  row: { id: string; activeMode: MainLifeMode; endsAt: Date | null; confidence: number };
} | null> {
  const now = new Date();
  const row = await prisma.userProfileMode.findFirst({
    where: {
      userId,
      sourceType: MANUAL,
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
    },
    orderBy: { startsAt: 'desc' },
  });
  return row ? { row } : null;
}

export async function getEffectiveLifeMode(userId: string): Promise<{
  mode: MainLifeMode;
  source: 'manual' | 'default';
  endsAt: Date | null;
}> {
  const manual = await getActiveManualMode(userId);
  if (manual) {
    return { mode: manual.row.activeMode, source: 'manual', endsAt: manual.row.endsAt };
  }
  const profile = await prisma.userProfile.findUnique({ where: { userId } });
  return {
    mode: profile?.mainLifeModeDefault ?? 'MIXED',
    source: 'default',
    endsAt: null,
  };
}

export async function setManualLifeMode(args: {
  userId: string;
  activeMode: MainLifeMode;
  durationHours?: number;
}): Promise<{ id: string }> {
  const now = new Date();
  const ms = Math.min(168, Math.max(1, args.durationHours ?? 8)) * 60 * 60 * 1000;
  const endsAt = new Date(now.getTime() + ms);

  await prisma.userProfileMode.updateMany({
    where: { userId: args.userId, sourceType: MANUAL, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
    data: { endsAt: now },
  });

  const row = await prisma.userProfileMode.create({
    data: {
      userId: args.userId,
      activeMode: args.activeMode,
      sourceType: MANUAL,
      startsAt: now,
      endsAt,
      confidence: 1,
    },
  });
  return { id: row.id };
}

export async function clearManualLifeModes(userId: string): Promise<void> {
  const now = new Date();
  await prisma.userProfileMode.updateMany({
    where: { userId, sourceType: MANUAL, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
    data: { endsAt: now },
  });
}
