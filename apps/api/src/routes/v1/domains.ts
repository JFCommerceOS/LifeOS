import type { FastifyInstance } from 'fastify';
import { DomainRuntimeState } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@life-os/database';
import { getUserId } from '../../lib/user.js';
import {
  getDomainCatalogEntry,
  getUserDomainDetail,
  listDomainCatalog,
  listUserDomainProfile,
} from '../../services/adaptive-domain-service.js';
import { patchUserDomainProfile } from '../../services/domain-activation-service.js';
import { isDomainBehaviorAllowed } from '../../services/domain-behavior-service.js';
import { getDomainTrustSummary, recomputeDomainTrust } from '../../services/domain-trust-service.js';
import { getToneHintsForUser } from '../../services/domain-tone-service.js';
import { getUiAdaptationHints } from '../../services/domain-ui-adaptation-service.js';

const patchProfileBody = z
  .object({
    runtimeState: z.nativeEnum(DomainRuntimeState).optional(),
    activationStrength: z.enum(['low', 'medium', 'high']).optional(),
    confidence: z.number().min(0).max(1).optional(),
    sourceSignalsJson: z.string().optional(),
    reasonSummary: z.string().optional(),
    triggeredBy: z.string().min(1).optional(),
  })
  .strict();

const behaviorQuery = z.object({ behaviorKey: z.string().min(1) });

export async function registerDomainRoutes(app: FastifyInstance) {
  app.get('/domains/adaptation/ui', async (_req, reply) => {
    const userId = await getUserId();
    const hints = await getUiAdaptationHints(userId);
    return reply.send({ ui: hints });
  });

  app.get('/domains/adaptation/tone', async (_req, reply) => {
    const userId = await getUserId();
    const tone = await getToneHintsForUser(userId);
    return reply.send({ tone });
  });

  app.get('/domains/profile', async (_req, reply) => {
    const userId = await getUserId();
    const profile = await listUserDomainProfile(userId);
    return reply.send({ profile });
  });

  app.get('/domains/profile/:domainKey', async (req, reply) => {
    const userId = await getUserId();
    const domainKey = (req.params as { domainKey: string }).domainKey;
    const detail = await getUserDomainDetail(userId, domainKey);
    if (!detail) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Domain not found' } });
    return reply.send(detail);
  });

  app.patch('/domains/profile/:domainKey', async (req, reply) => {
    const userId = await getUserId();
    const domainKey = (req.params as { domainKey: string }).domainKey;
    const body = patchProfileBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const { reasonSummary, triggeredBy, ...patch } = body.data;
    try {
      const profile = await patchUserDomainProfile(
        userId,
        domainKey,
        patch,
        triggeredBy ?? 'user',
        reasonSummary,
      );
      return reply.send({ profile });
    } catch {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Domain not found' } });
    }
  });

  app.get('/domains/:domainKey/trust', async (req, reply) => {
    const userId = await getUserId();
    const domainKey = (req.params as { domainKey: string }).domainKey;
    const trust = await getDomainTrustSummary(userId, domainKey);
    if (!trust) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } });
    return reply.send({ trust });
  });

  app.get('/domains/:domainKey/history', async (req, reply) => {
    const userId = await getUserId();
    const domainKey = (req.params as { domainKey: string }).domainKey;
    const limit = z.coerce.number().int().min(1).max(200).optional().safeParse((req.query as { limit?: string }).limit);
    const take = limit.success && limit.data != null ? limit.data : 40;
    const events = await prisma.domainActivationEvent.findMany({
      where: { userId, domainKey },
      orderBy: { createdAt: 'desc' },
      take,
    });
    return reply.send({ events });
  });

  app.post('/domains/:domainKey/recompute', async (req, reply) => {
    const userId = await getUserId();
    const domainKey = (req.params as { domainKey: string }).domainKey;
    const result = await recomputeDomainTrust(userId, domainKey);
    if (!result) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } });
    return reply.send(result);
  });

  app.get('/domains/:domainKey/behavior', async (req, reply) => {
    const userId = await getUserId();
    const domainKey = (req.params as { domainKey: string }).domainKey;
    const q = behaviorQuery.safeParse(req.query ?? {});
    if (!q.success) return reply.status(400).send({ error: q.error.flatten() });
    const result = await isDomainBehaviorAllowed(userId, domainKey, q.data.behaviorKey);
    return reply.send(result);
  });

  app.get('/domains/:domainKey', async (req, reply) => {
    const domainKey = (req.params as { domainKey: string }).domainKey;
    const domain = await getDomainCatalogEntry(domainKey);
    if (!domain) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } });
    return reply.send({ domain });
  });

  app.get('/domains', async (_req, reply) => {
    const domains = await listDomainCatalog();
    return reply.send({ domains });
  });
}
