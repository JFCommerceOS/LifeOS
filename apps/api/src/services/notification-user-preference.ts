import { prisma } from '@life-os/database';

export async function ensureNotificationUserPreference(userId: string) {
  const existing = await prisma.notificationUserPreference.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.notificationUserPreference.create({
    data: { userId },
  });
}
