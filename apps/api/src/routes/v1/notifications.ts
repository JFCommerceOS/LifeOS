import { prisma } from '@life-os/database';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { renderNotificationForLockScreen } from '../../lib/notification-lock-screen-render.js';
import { parsePagination } from '../../lib/pagination.js';
import { buildPaginatedMeta } from '@life-os/shared';
import { applyNotificationSurfaceAction } from '../../services/notification-action-service.js';
import { ensureNotificationUserPreference } from '../../services/notification-user-preference.js';
import { getUserId } from '../../lib/user.js';

const prefPatch = z
  .object({
    lockScreenMode: z.enum(['private_default', 'redacted_reason', 'full_detail']).optional(),
    quietHoursEnabled: z.boolean().optional(),
    quietHoursStart: z.string().regex(/^\d{1,2}:\d{2}$/).nullable().optional(),
    quietHoursEnd: z.string().regex(/^\d{1,2}:\d{2}$/).nullable().optional(),
    criticalOverrideEnabled: z.boolean().optional(),
    doNowEnabled: z.boolean().optional(),
    doTodayEnabled: z.boolean().optional(),
    beforeNextEventEnabled: z.boolean().optional(),
    adminAlertsEnabled: z.boolean().optional(),
    documentAlertsEnabled: z.boolean().optional(),
    studyAlertsEnabled: z.boolean().optional(),
    healthAlertsEnabled: z.boolean().optional(),
    digestEnabled: z.boolean().optional(),
    digestTime: z.string().regex(/^\d{1,2}:\d{2}$/).nullable().optional(),
    preferredReminderWindowStart: z.string().regex(/^\d{1,2}:\d{2}$/).nullable().optional(),
    preferredReminderWindowEnd: z.string().regex(/^\d{1,2}:\d{2}$/).nullable().optional(),
    notificationVerbosity: z.enum(['calm', 'direct']).optional(),
  })
  .strict();

const actionBody = z
  .object({
    action: z.enum([
      'OPEN',
      'CONFIRM',
      'DISMISS',
      'RESOLVE',
      'SNOOZE',
      'MUTE_CATEGORY',
      'OPEN_DETAIL',
      'OPEN_EVIDENCE',
    ]),
    note: z.string().max(2000).optional(),
    snoozeMinutes: z.number().int().min(15).max(10080).optional(),
  })
  .strict();

function attachLockScreenDisplay<T extends { notificationType: string; title: string; bodySummary: string | null; reasonSummary: string | null }>(
  row: T,
  lockScreenMode: import('@prisma/client').NotificationLockScreenMode,
) {
  const display = renderNotificationForLockScreen(lockScreenMode, {
    notificationType: row.notificationType as import('@prisma/client').NotificationSurfaceKind,
    rawTitle: row.title,
    rawBody: row.bodySummary,
    rawReason: row.reasonSummary,
  });
  return { ...row, lockScreenDisplay: display };
}

export async function registerNotificationRoutes(app: FastifyInstance) {
  app.get('/notifications/preferences', async (_req, reply) => {
    const userId = await getUserId();
    const pref = await ensureNotificationUserPreference(userId);
    return reply.send({ preferences: pref });
  });

  app.patch('/notifications/preferences', async (req, reply) => {
    const userId = await getUserId();
    const body = prefPatch.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const pref = await ensureNotificationUserPreference(userId);
    const updated = await prisma.notificationUserPreference.update({
      where: { id: pref.id },
      data: body.data,
    });
    return reply.send({ preferences: updated });
  });

  app.get('/notifications', async (req, reply) => {
    const userId = await getUserId();
    const { page, pageSize, skip } = parsePagination(req);
    const pref = await ensureNotificationUserPreference(userId);
    const where = { userId };
    const [total, rows] = await Promise.all([
      prisma.notificationSurfaceEvent.count({ where }),
      prisma.notificationSurfaceEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);
    const data = rows.map((r) => attachLockScreenDisplay(r, pref.lockScreenMode));
    return reply.send({
      data,
      meta: buildPaginatedMeta(page, pageSize, total),
    });
  });

  app.get('/notifications/:notificationId', async (req, reply) => {
    const userId = await getUserId();
    const notificationId = z.string().parse((req.params as { notificationId: string }).notificationId);
    const pref = await ensureNotificationUserPreference(userId);
    const row = await prisma.notificationSurfaceEvent.findFirst({
      where: { id: notificationId, userId },
    });
    if (!row) return reply.status(404).send({ error: 'Not found' });
    return reply.send({
      notification: attachLockScreenDisplay(row, pref.lockScreenMode),
    });
  });

  app.post('/notifications/:notificationId/action', async (req, reply) => {
    const userId = await getUserId();
    const notificationId = z.string().parse((req.params as { notificationId: string }).notificationId);
    const body = actionBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const result = await applyNotificationSurfaceAction({
      userId,
      notificationId,
      action: body.data.action,
      note: body.data.note,
      snoozeMinutes: body.data.snoozeMinutes,
    });
    if (!result.ok) {
      const status = result.code === 'NOT_FOUND' ? 404 : 409;
      return reply.status(status).send({ error: { code: result.code, message: result.message } });
    }
    return reply.send({ ok: true });
  });
}
