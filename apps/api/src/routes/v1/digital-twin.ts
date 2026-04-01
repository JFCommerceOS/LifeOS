import { prisma } from '@life-os/database';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { buildDigitalTwin } from '../../lib/digital-twin.js';
import { writeAudit } from '../../lib/audit.js';
import { getUserId } from '../../lib/user.js';

const patchBody = z
  .object({
    traitCorrections: z
      .record(z.object({ note: z.string().optional(), overrideSummary: z.string().optional() }))
      .optional(),
    disabledInferenceKeys: z.array(z.string()).optional(),
  })
  .strict();

const purgeBody = z.object({
  scope: z.enum(['all', 'corrections', 'visibility']),
});

function safeParseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function registerDigitalTwinRoutes(app: FastifyInstance) {
  app.get('/digital-twin', async (_req, reply) => {
    const userId = await getUserId();
    const twin = await buildDigitalTwin(userId);
    const row = await prisma.digitalTwinProfile.findUnique({ where: { userId } });
    const disabledInferenceKeys = safeParseJson<string[]>(row?.disabledInferenceKeysJson ?? '[]', []);
    return reply.send({ ...twin, disabledInferenceKeys });
  });

  app.patch('/digital-twin', async (req, reply) => {
    const userId = await getUserId();
    const body = patchBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const existing = await prisma.digitalTwinProfile.findUnique({ where: { userId } });
    const prevCorr = safeParseJson<Record<string, { note?: string; overrideSummary?: string }>>(
      existing?.correctionsJson ?? '{}',
      {},
    );
    const mergedCorr = body.data.traitCorrections
      ? { ...prevCorr, ...body.data.traitCorrections }
      : prevCorr;
    const disabledJson =
      body.data.disabledInferenceKeys !== undefined
        ? JSON.stringify(body.data.disabledInferenceKeys)
        : (existing?.disabledInferenceKeysJson ?? '[]');

    const row = await prisma.digitalTwinProfile.upsert({
      where: { userId },
      create: {
        userId,
        correctionsJson: JSON.stringify(mergedCorr),
        disabledInferenceKeysJson: disabledJson,
      },
      update: {
        correctionsJson: JSON.stringify(mergedCorr),
        ...(body.data.disabledInferenceKeys !== undefined
          ? { disabledInferenceKeysJson: disabledJson }
          : {}),
      },
    });

    await writeAudit(userId, 'digital_twin.patch', { meta: { fields: Object.keys(body.data) } });
    const twin = await buildDigitalTwin(userId);
    const row2 = await prisma.digitalTwinProfile.findUnique({ where: { userId } });
    const disabledInferenceKeys = safeParseJson<string[]>(row2?.disabledInferenceKeysJson ?? '[]', []);
    return reply.send({ profile: row, twin: { ...twin, disabledInferenceKeys } });
  });

  app.post('/digital-twin/purge', async (req, reply) => {
    const userId = await getUserId();
    const body = purgeBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const existing = await prisma.digitalTwinProfile.findUnique({ where: { userId } });
    const scope = body.data.scope;

    let correctionsJson = existing?.correctionsJson ?? '{}';
    let disabledInferenceKeysJson = existing?.disabledInferenceKeysJson ?? '[]';

    if (scope === 'all') {
      correctionsJson = '{}';
      disabledInferenceKeysJson = '[]';
    } else if (scope === 'corrections') {
      correctionsJson = '{}';
    } else if (scope === 'visibility') {
      disabledInferenceKeysJson = '[]';
    }

    const row = await prisma.digitalTwinProfile.upsert({
      where: { userId },
      create: {
        userId,
        correctionsJson,
        disabledInferenceKeysJson,
      },
      update: { correctionsJson, disabledInferenceKeysJson },
    });

    await writeAudit(userId, 'digital_twin.purge', { meta: { scope } });
    const twin = await buildDigitalTwin(userId);
    const row2 = await prisma.digitalTwinProfile.findUnique({ where: { userId } });
    const disabledInferenceKeys = safeParseJson<string[]>(row2?.disabledInferenceKeysJson ?? '[]', []);
    return reply.send({ profile: row, twin: { ...twin, disabledInferenceKeys } });
  });
}
