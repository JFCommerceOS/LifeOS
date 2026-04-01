import type { FastifyInstance } from 'fastify';
import { CapabilityRuntimeState } from '@prisma/client';
import { z } from 'zod';
import { getUserId } from '../../lib/user.js';
import { evaluateActivationReadiness, proposeActivateIfReady } from '../../services/capability-activation-service.js';
import { isBehaviorAllowed } from '../../services/capability-behavior-service.js';
import {
  getCapabilityForUser,
  listCapabilitiesForUser,
  patchCapabilityState,
} from '../../services/capability-registry-service.js';
import {
  createPurposePermission,
  listPurposePermissions,
  patchPurposePermission,
} from '../../services/capability-permission-service.js';
import { getOnboardingHints } from '../../services/progressive-onboarding-service.js';
import { recomputeTrustScore, getTrustSummary } from '../../services/capability-trust-service.js';
import { prisma } from '@life-os/database';
import { CAPABILITY_DEFINITIONS } from '../../services/capability-catalog.js';

const patchStateBody = z
  .object({
    runtimeState: z.nativeEnum(CapabilityRuntimeState),
    reasonSummary: z.string().optional(),
    triggeredBy: z.string().min(1).optional(),
  })
  .strict();

const requestPermissionBody = z
  .object({
    capabilityKey: z.string().min(1),
    sourceType: z.string().min(1),
    permissionScope: z.string().min(1),
    purposeLabel: z.string().min(1),
    granted: z.boolean().optional(),
  })
  .strict();

const patchPermissionBody = z
  .object({
    granted: z.boolean().optional(),
    revokedAt: z.string().datetime().nullable().optional(),
  })
  .strict();

const behaviorQuery = z.object({
  behaviorKey: z.string().min(1),
});

export async function registerCapabilityRoutes(app: FastifyInstance) {
  app.get('/capabilities/onboarding/hints', async (_req, reply) => {
    const userId = await getUserId();
    const hints = await getOnboardingHints(userId);
    return reply.send(hints);
  });

  app.get('/capabilities', async (_req, reply) => {
    const userId = await getUserId();
    const capabilities = await listCapabilitiesForUser(userId);
    return reply.send({ capabilities });
  });

  app.get('/permissions', async (_req, reply) => {
    const userId = await getUserId();
    const permissions = await listPurposePermissions(userId);
    return reply.send({ permissions });
  });

  /** Static purpose catalog for “permission by purpose” UX (no user id required for definitions). */
  app.get('/permissions/purpose-catalog', async (_req, reply) => {
    return reply.send({
      entries: CAPABILITY_DEFINITIONS.map((e) => ({
        capabilityKey: e.capabilityKey,
        purposeLabel: e.purposeLabel,
        explanationTemplate: e.explanationTemplate,
        dataSourcesRequired: e.dataSourcesRequired,
        permissionScopeRequired: e.permissionScopeRequired,
        defaultAllowedBehaviors: e.defaultAllowedBehaviors,
        defaultBlockedBehaviors: e.defaultBlockedBehaviors,
      })),
    });
  });

  app.post('/permissions/request', async (req, reply) => {
    const userId = await getUserId();
    const body = requestPermissionBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const permission = await createPurposePermission(userId, body.data);
    return reply.status(201).send({ permission });
  });

  app.patch('/permissions/:id', async (req, reply) => {
    const userId = await getUserId();
    const id = (req.params as { id: string }).id;
    const body = patchPermissionBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const permission = await patchPurposePermission(userId, id, body.data);
    if (!permission) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } });
    return reply.send({ permission });
  });

  app.get('/capabilities/:capabilityKey/history', async (req, reply) => {
    const userId = await getUserId();
    const capabilityKey = (req.params as { capabilityKey: string }).capabilityKey;
    const limit = z.coerce.number().int().min(1).max(200).optional().safeParse((req.query as { limit?: string }).limit);
    const take = limit.success && limit.data != null ? limit.data : 40;
    const events = await prisma.capabilityActivationEvent.findMany({
      where: { userId, capabilityKey },
      orderBy: { createdAt: 'desc' },
      take,
    });
    return reply.send({ events });
  });

  app.get('/capabilities/:capabilityKey/trust', async (req, reply) => {
    const userId = await getUserId();
    const capabilityKey = (req.params as { capabilityKey: string }).capabilityKey;
    const trust = await getTrustSummary(userId, capabilityKey);
    if (!trust) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } });
    return reply.send({ trust });
  });

  app.post('/capabilities/:capabilityKey/recompute', async (req, reply) => {
    const userId = await getUserId();
    const capabilityKey = (req.params as { capabilityKey: string }).capabilityKey;
    const result = await recomputeTrustScore(userId, capabilityKey);
    if (!result) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } });
    return reply.send(result);
  });

  app.get('/capabilities/:capabilityKey/evaluate', async (req, reply) => {
    const userId = await getUserId();
    const capabilityKey = (req.params as { capabilityKey: string }).capabilityKey;
    const conf = z.coerce.number().min(0).max(1).optional().safeParse((req.query as { confidence?: string }).confidence);
    const confidence = conf.success ? conf.data : undefined;
    const evaluation = await evaluateActivationReadiness(userId, capabilityKey, confidence);
    return reply.send({ evaluation });
  });

  app.get('/capabilities/:capabilityKey/behavior', async (req, reply) => {
    const userId = await getUserId();
    const capabilityKey = (req.params as { capabilityKey: string }).capabilityKey;
    const q = behaviorQuery.safeParse(req.query ?? {});
    if (!q.success) return reply.status(400).send({ error: q.error.flatten() });
    const result = await isBehaviorAllowed(userId, capabilityKey, q.data.behaviorKey);
    return reply.send(result);
  });

  app.post('/capabilities/:capabilityKey/activate-if-ready', async (req, reply) => {
    const userId = await getUserId();
    const capabilityKey = (req.params as { capabilityKey: string }).capabilityKey;
    const body = z
      .object({ confidence: z.number().min(0).max(1).optional(), triggeredBy: z.string().optional() })
      .strict()
      .safeParse(req.body ?? {});
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const result = await proposeActivateIfReady(
      userId,
      capabilityKey,
      body.data.confidence,
      body.data.triggeredBy ?? 'user',
    );
    return reply.send(result);
  });

  app.get('/capabilities/:capabilityKey', async (req, reply) => {
    const userId = await getUserId();
    const capabilityKey = (req.params as { capabilityKey: string }).capabilityKey;
    const detail = await getCapabilityForUser(userId, capabilityKey);
    if (!detail) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } });
    return reply.send(detail);
  });

  app.patch('/capabilities/:capabilityKey/state', async (req, reply) => {
    const userId = await getUserId();
    const capabilityKey = (req.params as { capabilityKey: string }).capabilityKey;
    const body = patchStateBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    try {
      const registry = await patchCapabilityState(
        userId,
        capabilityKey,
        body.data.runtimeState,
        body.data.triggeredBy ?? 'user',
        body.data.reasonSummary,
      );
      return reply.send({ registry });
    } catch {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Capability not found' } });
    }
  });
}
