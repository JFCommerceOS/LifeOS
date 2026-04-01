import { prisma } from '@life-os/database';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { writeAudit } from '../../lib/audit.js';
import { getUserId } from '../../lib/user.js';
import { parsePagination } from '../../lib/pagination.js';
import { buildPaginatedMeta } from '@life-os/shared';

const createBody = z.object({
  personId: z.string().optional(),
  title: z.string().optional(),
  summary: z.string().optional(),
  occurredAt: z.string().datetime().optional(),
});

export async function registerConversationRoutes(app: FastifyInstance) {
  app.get('/conversations', async (req, reply) => {
    const userId = await getUserId();
    const { page, pageSize, skip } = parsePagination(req);
    const where = { userId };
    const [total, conversations] = await Promise.all([
      prisma.conversation.count({ where }),
      prisma.conversation.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        skip,
        take: pageSize,
        include: { person: true },
      }),
    ]);
    return reply.send({
      data: conversations,
      meta: buildPaginatedMeta(page, pageSize, total),
    });
  });

  app.get('/conversations/:id', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const conversation = await prisma.conversation.findFirst({
      where: { id, userId },
      include: { person: true },
    });
    if (!conversation) return reply.status(404).send({ error: 'Not found' });
    return reply.send({ conversation });
  });

  app.post('/conversations', async (req, reply) => {
    const userId = await getUserId();
    const body = createBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const occurredAt = body.data.occurredAt ? new Date(body.data.occurredAt) : new Date();
    if (body.data.personId) {
      const person = await prisma.person.findFirst({
        where: { id: body.data.personId, userId },
      });
      if (!person) return reply.status(400).send({ error: 'personId not found' });
    }
    const conversation = await prisma.conversation.create({
      data: {
        userId,
        personId: body.data.personId,
        title: body.data.title,
        summary: body.data.summary,
        occurredAt,
      },
      include: { person: true },
    });
    if (conversation.personId) {
      await prisma.person.update({
        where: { id: conversation.personId },
        data: { lastInteractionAt: occurredAt },
      });
    }
    await writeAudit(userId, 'conversation.create', {
      entityType: 'Conversation',
      entityId: conversation.id,
    });
    return reply.status(201).send({ conversation });
  });
}
