import { prisma } from '@life-os/database';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { writeAudit } from '../../lib/audit.js';
import { getUserId } from '../../lib/user.js';

const patchBody = z
  .object({
    timezone: z.string().optional(),
    retentionDays: z.number().int().min(1).max(3650).optional(),
    privacyStrictMode: z.boolean().optional(),
    connectorTogglesJson: z.string().optional(),
    patternSignalsOptIn: z.boolean().optional(),
    lifestyleInsightsOptIn: z.boolean().optional(),
    predictiveModeOptIn: z.boolean().optional(),
    deviceSyncOptIn: z.boolean().optional(),
    syncExcludedModulesJson: z.string().optional(),
    ambientTileShowDetail: z.boolean().optional(),
    ambientTileManualMode: z.string().nullable().optional(),
    voiceCaptureEnabled: z.boolean().optional(),
    voiceRetainRawAudio: z.boolean().optional(),
    voiceTranscriptAutosave: z.boolean().optional(),
    spokenReadoutEnabled: z.boolean().optional(),
    locationIntelligenceOptIn: z.boolean().optional(),
    everyoneModeEnabled: z.boolean().optional(),
    onboardingCompletedAt: z.string().datetime().nullable().optional(),
    healthDomainSurfacePolicy: z.enum(['strict', 'standard']).optional(),
    financeDomainSurfacePolicy: z.enum(['strict', 'standard']).optional(),
    watchSensitiveDetailOptIn: z.boolean().optional(),
    syncOutboxPaused: z.boolean().optional(),
  })
  .strict();

export async function registerSettingsRoutes(app: FastifyInstance) {
  app.get('/settings', async (_req, reply) => {
    const userId = await getUserId();
    let settings = await prisma.userSettings.findUnique({ where: { userId } });
    if (!settings) {
      settings = await prisma.userSettings.create({ data: { userId } });
    }
    return reply.send({ settings });
  });

  app.patch('/settings', async (req, reply) => {
    const userId = await getUserId();
    const body = patchBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const settings = await prisma.userSettings.upsert({
      where: { userId },
      create: { userId, ...body.data },
      update: body.data,
    });
    await writeAudit(userId, 'settings.patch', { meta: { fields: Object.keys(body.data) } });
    return reply.send({ settings });
  });
}
