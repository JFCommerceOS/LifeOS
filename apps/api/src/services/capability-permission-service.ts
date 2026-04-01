import { prisma } from '@life-os/database';
import { ensureUserCapabilities } from './capability-registry-service.js';

export async function listPurposePermissions(userId: string) {
  await ensureUserCapabilities(userId);
  return prisma.capabilityPermission.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createPurposePermission(
  userId: string,
  input: {
    capabilityKey: string;
    sourceType: string;
    permissionScope: string;
    purposeLabel: string;
    granted?: boolean;
  },
) {
  await ensureUserCapabilities(userId);
  const granted = input.granted ?? true;
  const row = await prisma.capabilityPermission.create({
    data: {
      userId,
      capabilityKey: input.capabilityKey,
      sourceType: input.sourceType,
      permissionScope: input.permissionScope,
      purposeLabel: input.purposeLabel,
      granted,
      grantedAt: granted ? new Date() : null,
    },
  });

  if (granted) {
    await prisma.userCapabilityRegistry.updateMany({
      where: { userId, capabilityKey: input.capabilityKey },
      data: { runtimeState: 'passive' },
    });
  }

  return row;
}

export async function patchPurposePermission(
  userId: string,
  id: string,
  patch: { granted?: boolean; revokedAt?: string | null },
) {
  const row = await prisma.capabilityPermission.findFirst({ where: { id, userId } });
  if (!row) return null;
  const revokedAt = patch.revokedAt === undefined ? undefined : patch.revokedAt ? new Date(patch.revokedAt) : null;
  const granted = patch.granted;
  return prisma.capabilityPermission.update({
    where: { id },
    data: {
      ...(granted !== undefined ? { granted, grantedAt: granted ? new Date() : null } : {}),
      ...(revokedAt !== undefined ? { revokedAt } : {}),
    },
  });
}
