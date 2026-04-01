import type { PolicyOutcome, PolicySurfaceKind, Prisma } from '@prisma/client';
import { prisma } from '@life-os/database';

/**
 * Persist a policy outcome for an automated action (Hardening Phase A — explainability).
 * First surface: `notification_delivery` from mediation → notification pipeline.
 */
export async function recordPolicyDecision(args: {
  userId: string;
  surface: PolicySurfaceKind;
  outcome: PolicyOutcome;
  reasonCodes: string[];
  context?: Record<string, unknown> | null;
  refEntityType?: string | null;
  refEntityId?: string | null;
  notificationSurfaceEventId?: string | null;
}): Promise<void> {
  await prisma.policyDecision.create({
    data: {
      userId: args.userId,
      surface: args.surface,
      outcome: args.outcome,
      reasonCodes: args.reasonCodes,
      context:
        args.context != null ? (args.context as unknown as Prisma.InputJsonValue) : undefined,
      refEntityType: args.refEntityType ?? undefined,
      refEntityId: args.refEntityId ?? undefined,
      notificationSurfaceEventId: args.notificationSurfaceEventId ?? undefined,
    },
  });
}
