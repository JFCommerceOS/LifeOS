import type { Prisma } from '@life-os/database';
import { prisma } from '@life-os/database';

export async function writeAudit(
  userId: string,
  action: string,
  opts?: { entityType?: string; entityId?: string; meta?: Record<string, unknown> },
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId,
      action,
      entityType: opts?.entityType,
      entityId: opts?.entityId,
      metaJson: JSON.stringify(opts?.meta ?? {}),
    },
  });
}

export type AuditTx = Prisma.TransactionClient;
