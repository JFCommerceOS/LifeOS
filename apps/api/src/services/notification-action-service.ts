import type { NotificationActionKind } from '@prisma/client';
import { prisma } from '@life-os/database';
import { writeAudit } from '../lib/audit.js';
import {
  applyObligationLifecycle,
  InvalidLifecycleTransitionError,
} from './continuity-obligation-lifecycle.js';

const SNOOZE_MS_DEFAULT = 4 * 60 * 60 * 1000;

export async function applyNotificationSurfaceAction(args: {
  userId: string;
  notificationId: string;
  action: NotificationActionKind;
  note?: string | null;
  snoozeMinutes?: number | null;
}): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  const { userId, notificationId, action, note, snoozeMinutes } = args;

  const ev = await prisma.notificationSurfaceEvent.findFirst({
    where: { id: notificationId, userId },
  });
  if (!ev) return { ok: false, code: 'NOT_FOUND', message: 'Notification not found' };

  await prisma.notificationActionLog.create({
    data: {
      userId,
      notificationEventId: notificationId,
      actionType: action,
      note: note?.trim() || null,
    },
  });

  const now = new Date();

  if (action === 'OPEN' || action === 'OPEN_DETAIL') {
    await prisma.notificationSurfaceEvent.update({
      where: { id: notificationId },
      data: { openedAt: ev.openedAt ?? now, deliveryStatus: 'OPENED' },
    });
    return { ok: true };
  }

  if (action === 'OPEN_EVIDENCE') {
    await prisma.notificationSurfaceEvent.update({
      where: { id: notificationId },
      data: { openedAt: ev.openedAt ?? now, deliveryStatus: 'OPENED' },
    });
    return { ok: true };
  }

  if (action === 'MUTE_CATEGORY') {
    await prisma.notificationSurfaceEvent.update({
      where: { id: notificationId },
      data: { actedAt: now, deliveryStatus: 'ACTED_ON' },
    });
    await writeAudit(userId, 'notification.mute_category', {
      entityType: 'NotificationSurfaceEvent',
      entityId: notificationId,
      meta: { notificationType: ev.notificationType },
    });
    return { ok: true };
  }

  if (ev.linkedEntityType === 'Obligation') {
    const ob = await prisma.obligation.findFirst({
      where: { id: ev.linkedEntityId, userId },
    });
    if (!ob) {
      await prisma.notificationSurfaceEvent.update({
        where: { id: notificationId },
        data: { actedAt: now, deliveryStatus: 'ACTED_ON' },
      });
      return { ok: true };
    }

    try {
      if (action === 'CONFIRM') {
        await applyObligationLifecycle({
          userId,
          obligationId: ob.id,
          existing: ob,
          action: 'confirm',
        });
      } else if (action === 'DISMISS') {
        await applyObligationLifecycle({
          userId,
          obligationId: ob.id,
          existing: ob,
          action: 'dismiss',
          dismissNote: note,
        });
      } else if (action === 'RESOLVE') {
        await applyObligationLifecycle({
          userId,
          obligationId: ob.id,
          existing: ob,
          action: 'resolve',
        });
      } else if (action === 'SNOOZE') {
        const ms = Math.min(
          7 * 24 * 60 * 60 * 1000,
          Math.max(15 * 60 * 1000, (snoozeMinutes ?? SNOOZE_MS_DEFAULT / 60000) * 60 * 1000),
        );
        await prisma.obligation.update({
          where: { id: ob.id },
          data: { suppressionUntil: new Date(now.getTime() + ms) },
        });
        await writeAudit(userId, 'obligation.snooze', {
          entityType: 'Obligation',
          entityId: ob.id,
          meta: { fromNotification: notificationId, ms },
        });
      }

      await prisma.notificationSurfaceEvent.update({
        where: { id: notificationId },
        data: { actedAt: now, deliveryStatus: 'ACTED_ON' },
      });
      await writeAudit(userId, 'notification.action', {
        entityType: 'NotificationSurfaceEvent',
        entityId: notificationId,
        meta: { action, obligationId: ob.id },
      });
      return { ok: true };
    } catch (e) {
      if (e instanceof InvalidLifecycleTransitionError) {
        return { ok: false, code: 'INVALID_TRANSITION', message: e.message };
      }
      throw e;
    }
  }

  await prisma.notificationSurfaceEvent.update({
    where: { id: notificationId },
    data: { actedAt: now, deliveryStatus: 'ACTED_ON' },
  });
  return { ok: true };
}
