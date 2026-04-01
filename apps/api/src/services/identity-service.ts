import type { PrimaryAuthMethod } from '@prisma/client';
import { prisma } from '@life-os/database';
import { ensureDefaultUser } from '../lib/user.js';
import { createUserSession } from './session-service.js';

export async function bootstrapIdentity(): Promise<{
  user: { id: string; email: string | null; primaryAuthMethod: PrimaryAuthMethod };
  sessionToken: string;
  sessionExpiresAt: string;
}> {
  const userId = await ensureDefaultUser();

  const user = await prisma.user.update({
    where: { id: userId },
    data: { primaryAuthMethod: 'local_dev' },
    select: { id: true, email: true, primaryAuthMethod: true },
  });

  const { rawToken, expiresAt } = await createUserSession({ userId });

  return {
    user,
    sessionToken: rawToken,
    sessionExpiresAt: expiresAt.toISOString(),
  };
}
