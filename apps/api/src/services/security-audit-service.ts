import type { Prisma, SecurityAuditSeverity } from '@prisma/client';
import { prisma } from '@life-os/database';

export async function writeSecurityAuditLog(args: {
  userId: string;
  edgeDeviceId?: string | null;
  eventType: string;
  eventSummary: string;
  severity?: SecurityAuditSeverity;
  meta?: Record<string, unknown>;
}): Promise<void> {
  await prisma.securityAuditLog.create({
    data: {
      userId: args.userId,
      edgeDeviceId: args.edgeDeviceId ?? undefined,
      eventType: args.eventType,
      eventSummary: args.eventSummary,
      severity: args.severity ?? 'info',
      metaJson: args.meta != null ? (args.meta as unknown as Prisma.InputJsonValue) : undefined,
    },
  });
}
