import type { AuthStrength } from '@prisma/client';
import { prisma } from '@life-os/database';
import { generateSessionToken, hashSessionToken } from '@life-os/security';

const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function createUserSession(args: {
  userId: string;
  edgeDeviceId?: string | null;
  authStrength?: AuthStrength;
  ttlMs?: number;
}): Promise<{ rawToken: string; expiresAt: Date }> {
  const rawToken = generateSessionToken();
  const hash = hashSessionToken(rawToken);
  const expiresAt = new Date(Date.now() + (args.ttlMs ?? DEFAULT_TTL_MS));

  await prisma.userSession.create({
    data: {
      userId: args.userId,
      edgeDeviceId: args.edgeDeviceId ?? undefined,
      sessionTokenHash: hash,
      expiresAt,
      authStrength: args.authStrength ?? 'LOCAL_UNLOCK',
    },
  });

  return { rawToken, expiresAt };
}

export async function listSessionsForUser(userId: string) {
  return prisma.userSession.findMany({
    where: { userId, revokedAt: null },
    orderBy: { issuedAt: 'desc' },
    take: 50,
    select: {
      id: true,
      issuedAt: true,
      expiresAt: true,
      lastSeenAt: true,
      authStrength: true,
      edgeDeviceId: true,
    },
  });
}

export async function revokeSession(userId: string, sessionId: string): Promise<boolean> {
  const row = await prisma.userSession.findFirst({
    where: { id: sessionId, userId },
  });
  if (!row) return false;
  await prisma.userSession.update({
    where: { id: sessionId },
    data: { revokedAt: new Date() },
  });
  return true;
}

export async function revokeSessionsForDevice(edgeDeviceId: string): Promise<void> {
  await prisma.userSession.updateMany({
    where: { edgeDeviceId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
