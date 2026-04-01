import { prisma } from '@life-os/database';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { writeAudit } from '../../lib/audit.js';
import { getUserId } from '../../lib/user.js';

const bodySchema = z.object({
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  patchJson: z.string().min(1),
});

export async function registerMemoryCorrectionRoutes(app: FastifyInstance) {
  app.post('/memory-corrections', async (req, reply) => {
    const userId = await getUserId();
    const body = bodySchema.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const correction = await prisma.memoryCorrection.create({
      data: {
        userId,
        entityType: body.data.entityType,
        entityId: body.data.entityId,
        patchJson: body.data.patchJson,
      },
    });
    await writeAudit(userId, 'memory_correction.create', {
      entityType: 'MemoryCorrection',
      entityId: correction.id,
    });
    return reply.status(201).send({ correction });
  });
}
