import { prisma } from '@life-os/database';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getUserId } from '../../lib/user.js';
import {
  assembleCurrentContext,
  assembleEventContext,
  assembleObligationContext,
  assemblePersonCard,
} from '../../services/context-construction-service.js';

export async function registerContextRoutes(app: FastifyInstance) {
  app.get('/context/next-event', async (_req, reply) => {
    const userId = await getUserId();
    const event = await prisma.event.findFirst({
      where: { userId, startsAt: { gte: new Date() } },
      orderBy: { startsAt: 'asc' },
    });
    return reply.send({ event });
  });

  app.get('/context/current', async (_req, reply) => {
    const userId = await getUserId();
    const current = await assembleCurrentContext(userId);
    return reply.send(current);
  });

  app.get('/context/persons/:id/card', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const card = await assemblePersonCard(userId, id);
    if (!card) return reply.status(404).send({ error: 'Not found' });
    return reply.send({
      person: card.person,
      openObligations: card.openObligations,
      linkedNotes: card.linkedNotes,
      conversations: card.conversations,
    });
  });

  app.get('/context/persons/:id', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const card = await assemblePersonCard(userId, id);
    if (!card) return reply.status(404).send({ error: 'Not found' });

    const contextObject = await prisma.contextObject.findFirst({
      where: {
        userId,
        contextType: 'PERSON_CONTEXT',
        linkedEntityType: 'Person',
        linkedEntityId: id,
      },
      orderBy: { updatedAt: 'desc' },
    });

    return reply.send({
      person: card.person,
      openObligations: card.openObligations,
      linkedNotes: card.linkedNotes,
      conversations: card.conversations,
      contextObject,
    });
  });

  app.get('/context/events/:id/brief', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const bundle = await assembleEventContext(userId, id);
    if (!bundle) return reply.status(404).send({ error: 'Not found' });

    return reply.send({
      event: bundle.event,
      participants: bundle.participants,
      priorNotes: bundle.priorNotes,
      relatedDocuments: bundle.relatedDocuments,
      openObligations: bundle.openObligations,
      lastDiscussed: bundle.lastDiscussed,
      prepSummary: bundle.prepSummary,
    });
  });

  app.get('/context/event/:id', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const b = await assembleEventContext(userId, id);
    if (!b) return reply.status(404).send({ error: { message: 'Not found', code: 'NOT_FOUND' } });
    return reply.send({
      event: b.event,
      participants: b.participants,
      priorNotes: b.priorNotes,
      relatedDocuments: b.relatedDocuments,
      openObligations: b.openObligations,
      lastDiscussed: b.lastDiscussed,
      prepSummary: b.prepSummary,
    });
  });

  app.get('/context/events/:id', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const bundle = await assembleEventContext(userId, id);
    if (!bundle) return reply.status(404).send({ error: 'Not found' });

    const contextObject = await prisma.contextObject.findFirst({
      where: {
        userId,
        contextType: 'EVENT_CONTEXT',
        linkedEntityType: 'Event',
        linkedEntityId: id,
      },
      orderBy: { updatedAt: 'desc' },
    });

    return reply.send({
      event: bundle.event,
      participants: bundle.participants,
      priorNotes: bundle.priorNotes,
      relatedDocuments: bundle.relatedDocuments,
      openObligations: bundle.openObligations,
      lastDiscussed: bundle.lastDiscussed,
      prepSummary: bundle.prepSummary,
      contextObject,
    });
  });

  app.get('/context/person/:id', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const card = await assemblePersonCard(userId, id);
    if (!card) return reply.status(404).send({ error: { message: 'Not found', code: 'NOT_FOUND' } });
    const contextObject = await prisma.contextObject.findFirst({
      where: {
        userId,
        contextType: 'PERSON_CONTEXT',
        linkedEntityType: 'Person',
        linkedEntityId: id,
      },
      orderBy: { updatedAt: 'desc' },
    });
    const personRow = await prisma.person.findFirst({
      where: { id, userId },
      include: { aliases: { orderBy: { createdAt: 'desc' } } },
    });
    return reply.send({
      person: personRow ?? card.person,
      openObligations: card.openObligations,
      linkedNotes: card.linkedNotes,
      conversations: card.conversations,
      contextObject,
    });
  });

  app.get('/context/bundles', async (req, reply) => {
    const userId = await getUserId();
    const take = Math.min(50, z.coerce.number().int().min(1).max(50).parse((req.query as { limit?: string }).limit ?? '20'));
    const bundles = await prisma.contextBundle.findMany({
      where: { userId },
      orderBy: { generatedAt: 'desc' },
      take,
      include: { items: { take: 12 } },
    });
    return reply.send({ bundles });
  });

  app.get('/context/bundles/:id', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const bundle = await prisma.contextBundle.findFirst({
      where: { id, userId },
      include: { items: { orderBy: { priorityScore: 'desc' } } },
    });
    if (!bundle) return reply.status(404).send({ error: { message: 'Not found', code: 'NOT_FOUND' } });
    return reply.send({ bundle });
  });

  app.get('/context/obligations/:id', async (req, reply) => {
    const userId = await getUserId();
    const id = z.string().parse((req.params as { id: string }).id);
    const ob = await assembleObligationContext(userId, id);
    if (!ob) return reply.status(404).send({ error: 'Not found' });

    const contextObject = await prisma.contextObject.findFirst({
      where: {
        userId,
        contextType: 'OBLIGATION_CONTEXT',
        linkedEntityType: 'Obligation',
        linkedEntityId: id,
      },
      orderBy: { updatedAt: 'desc' },
    });

    return reply.send({
      obligation: ob.obligation,
      links: ob.links,
      linkedNotes: ob.linkedNotes,
      linkedEvents: ob.linkedEvents,
      summary: ob.summary,
      contextObject,
    });
  });
}
