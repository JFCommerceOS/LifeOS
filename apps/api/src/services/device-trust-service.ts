import type { DeviceTrustLevel, DeviceTrustStatus } from '@prisma/client';
import { prisma } from '@life-os/database';
import { revokeSessionsForDevice } from './session-service.js';
import { writeAudit } from '../lib/audit.js';

export async function setDeviceTrust(args: {
  userId: string;
  deviceId: string;
  trustStatus?: DeviceTrustStatus;
  trustLevel?: DeviceTrustLevel;
}): Promise<{ ok: true; device: unknown } | { ok: false; code: string }> {
  const row = await prisma.edgeDevice.findFirst({
    where: { id: args.deviceId, userId: args.userId },
  });
  if (!row) return { ok: false, code: 'NOT_FOUND' };

  const device = await prisma.edgeDevice.update({
    where: { id: args.deviceId },
    data: {
      ...(args.trustStatus !== undefined ? { trustStatus: args.trustStatus } : {}),
      ...(args.trustLevel !== undefined ? { trustLevel: args.trustLevel } : {}),
      lastSeenAt: new Date(),
    },
  });

  await writeAudit(args.userId, 'device.trust_updated', {
    entityType: 'EdgeDevice',
    entityId: device.id,
    meta: { trustStatus: device.trustStatus, trustLevel: device.trustLevel },
  });

  return { ok: true, device };
}

export async function revokeDevice(userId: string, deviceId: string): Promise<boolean> {
  const row = await prisma.edgeDevice.findFirst({
    where: { id: deviceId, userId },
  });
  if (!row) return false;

  await prisma.edgeDevice.update({
    where: { id: deviceId },
    data: {
      trustStatus: 'REVOKED',
      revokedAt: new Date(),
    },
  });

  await revokeSessionsForDevice(deviceId);
  await writeAudit(userId, 'device.revoked', { entityType: 'EdgeDevice', entityId: deviceId });
  return true;
}
