import { prisma } from '@life-os/database';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { writeAudit } from '../../lib/audit.js';
import { getUserId } from '../../lib/user.js';
import { isEntityTypeName } from '../../lib/entity-graph.js';

const createBody = z.object({
  fromEntityType: z.string(),
  fromEntityId: z.string().min(1),
  toEntityType: z.string(),
  toEntityId: z.string().min(1),
  relationType: z.string().min(1),
  confidence: z.number().min(0).max(1).optional(),
  reasonSummary: z.string().max(2000).optional(),
});

export async function registerEntityLinkRoutes(app: FastifyInstance) {
  app.post('/entity-links', async (req, reply) => {
    const userId = await getUserId();
    const body = createBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const { fromEntityType, fromEntityId, toEntityType, toEntityId, relationType } = body.data;
    if (!isEntityTypeName(fromEntityType) || !isEntityTypeName(toEntityType)) {
      return reply.status(400).send({
        error: `fromEntityType and toEntityType must be one of: Person, Event, Note, Obligation, Conversation, Document`,
      });
    }
    const dup = await prisma.entityLink.findFirst({
      where: {
        userId,
        fromEntityType,
        fromEntityId,
        toEntityType,
        toEntityId,
        relationType,
      },
    });
    if (dup) return reply.status(409).send({ error: 'Link already exists', link: dup });

    const link = await prisma.entityLink.create({
      data: {
        userId,
        fromEntityType,
        fromEntityId,
        toEntityType,
        toEntityId,
        relationType,
        confidence: body.data.confidence ?? 0.72,
        reasonSummary: body.data.reasonSummary ?? '',
      },
    });
    await writeAudit(userId, 'entity_link.create', {
      entityType: 'EntityLink',
      entityId: link.id,
      meta: { relationType },
    });
    return reply.status(201).send({ link });
  });
}
