import type { FastifyRequest } from 'fastify';
import { prisma } from '@life-os/database';
import type { DeviceTrustStatus } from '@prisma/client';
import { hashSessionToken } from '@life-os/security';
import { ensureDefaultUser } from './user.js';

export type SecurityContext = {
  userId: string;
  sessionId: string | null;
  /** Resolved edge device row when `X-Client-Device-Id` matches a registered device. */
  edgeDevice: {
    id: string;
    clientDeviceId: string;
    trustStatus: DeviceTrustStatus;
  } | null;
};

/**
 * Resolves user from optional `Authorization: Bearer` session token, then optional `X-Client-Device-Id`
 * for device-scoped policy checks. Falls back to single-user dev user when no valid session.
 */
export async function resolveSecurityContext(req: FastifyRequest): Promise<SecurityContext> {
  const userIdFallback = await ensureDefaultUser();

  const auth = req.headers.authorization;
  let userId = userIdFallback;
  let sessionId: string | null = null;

  if (auth?.startsWith('Bearer ')) {
    const raw = auth.slice(7).trim();
    if (raw.length > 0) {
      const hash = hashSessionToken(raw);
      const session = await prisma.userSession.findFirst({
        where: {
          sessionTokenHash: hash,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
      });
      if (session) {
        userId = session.userId;
        sessionId = session.id;
        await prisma.userSession.update({
          where: { id: session.id },
          data: { lastSeenAt: new Date() },
        });
      }
    }
  }

  const clientDeviceHeader = req.headers['x-client-device-id'];
  const clientDeviceId =
    typeof clientDeviceHeader === 'string' ? clientDeviceHeader.trim() : undefined;

  let edgeDevice: SecurityContext['edgeDevice'] = null;
  if (clientDeviceId) {
    const edge = await prisma.edgeDevice.findFirst({
      where: { userId, clientDeviceId },
      select: { id: true, clientDeviceId: true, trustStatus: true },
    });
    if (edge) edgeDevice = edge;
  }

  return { userId, sessionId, edgeDevice };
}
