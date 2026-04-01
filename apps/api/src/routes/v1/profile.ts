import { prisma } from '@life-os/database';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { writeAudit } from '../../lib/audit.js';
import { getUserId } from '../../lib/user.js';

const patchBody = z
  .object({
    profileType: z
      .enum(['professional', 'student', 'parent', 'freelancer', 'caregiver', 'mixed'])
      .optional(),
    reminderTiming: z.enum(['morning', 'afternoon', 'evening', 'balanced']).optional(),
    notificationDensity: z.enum(['low', 'normal', 'high']).optional(),
    nudgeStyle: z.enum(['strict', 'gentle']).optional(),
    emphasisWork: z.number().min(0).max(1).optional(),
    emphasisFamily: z.number().min(0).max(1).optional(),
    emphasisHealth: z.number().min(0).max(1).optional(),
    displayName: z.string().min(1).max(120).nullable().optional(),
    preferredBriefDensity: z.enum(['MINIMAL', 'BALANCED', 'DETAILED']).optional(),
    uprReminderStyle: z.enum(['CALM', 'DIRECT', 'CHECKLIST', 'SUMMARY']).optional(),
    preferredEscalationWindowHours: z.number().int().min(1).max(168).nullable().optional(),
    workHoursWindowJson: z.string().max(8000).optional(),
    quietHoursWindowJson: z.string().max(8000).optional(),
    mainLifeModeDefault: z
      .enum([
        'WORK',
        'STUDY',
        'ADMIN',
        'PERSONAL',
        'MIXED',
        'TRAVEL',
        'HEALTH_RECORD_REVIEW',
      ])
      .optional(),
    priorityDomainWeightsJson: z.string().max(8000).optional(),
    confidenceThresholdPreferencesJson: z.string().max(8000).optional(),
    uprPrivacySensitivity: z.enum(['STANDARD', 'HIGH', 'STRICT']).optional(),
  })
  .strict();

async function ensureProfile(userId: string) {
  let p = await prisma.userProfile.findUnique({ where: { userId } });
  if (!p) {
    p = await prisma.userProfile.create({ data: { userId } });
  }
  return p;
}

export async function registerProfileRoutes(app: FastifyInstance) {
  app.get('/profile', async (_req, reply) => {
    const userId = await getUserId();
    const profile = await ensureProfile(userId);
    return reply.send({ profile });
  });

  app.patch('/profile', async (req, reply) => {
    const userId = await getUserId();
    const body = patchBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    await ensureProfile(userId);
    const profile = await prisma.userProfile.update({
      where: { userId },
      data: body.data,
    });
    await writeAudit(userId, 'profile.patch', { meta: { fields: Object.keys(body.data) } });
    return reply.send({ profile });
  });

  app.post('/profile/recompute', async (_req, reply) => {
    const userId = await getUserId();
    const profile = await ensureProfile(userId);
    const inferred = {
      lastRecomputedAt: new Date().toISOString(),
      hint: 'Stub inference — replace with real signals in later iterations.',
    };
    const updated = await prisma.userProfile.update({
      where: { userId },
      data: { inferredJson: JSON.stringify(inferred) },
    });
    await writeAudit(userId, 'profile.recompute', {});
    return reply.send({ profile: updated });
  });
}
