import { prisma } from '@life-os/database';
import type { PolicyDecisionArea } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parsePagination } from '../../lib/pagination.js';
import { resolveSecurityContext } from '../../lib/security-context.js';
import { evaluatePolicyAndLog } from '../../services/policy-engine-service.js';
import { buildPaginatedMeta } from '@life-os/shared';

const patchBody = z
  .object({
    healthDomainSurfacePolicy: z.enum(['strict', 'standard']).optional(),
    financeDomainSurfacePolicy: z.enum(['strict', 'standard']).optional(),
    watchSensitiveDetailOptIn: z.boolean().optional(),
  })
  .strict();

const evaluateBody = z
  .object({
    decisionArea: z.enum(['STORAGE', 'SURFACING', 'REDACTION', 'ACTION', 'EXPORT', 'DEVICE_ACCESS']),
    sourceEntityType: z.string().min(1).max(120),
    sourceEntityId: z.string().min(1).max(120),
    input: z.record(z.unknown()).optional(),
  })
  .strict();

export async function registerHardeningPolicyRoutes(app: FastifyInstance) {
  app.get('/policy', async (req, reply) => {
    const ctx = await resolveSecurityContext(req);
    const [settings, policies] = await Promise.all([
      prisma.userSettings.findUnique({ where: { userId: ctx.userId } }),
      prisma.securityPolicy.findMany({
        where: { userId: ctx.userId, isActive: true },
        orderBy: { updatedAt: 'desc' },
        take: 20,
      }),
    ]);
    return reply.send({
      settings: settings
        ? {
            healthDomainSurfacePolicy: settings.healthDomainSurfacePolicy,
            financeDomainSurfacePolicy: settings.financeDomainSurfacePolicy,
            watchSensitiveDetailOptIn: settings.watchSensitiveDetailOptIn,
          }
        : null,
      securityPolicies: policies,
    });
  });

  app.patch('/policy', async (req, reply) => {
    const body = patchBody.safeParse(req.body ?? {});
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const ctx = await resolveSecurityContext(req);
    const settings = await prisma.userSettings.upsert({
      where: { userId: ctx.userId },
      create: {
        userId: ctx.userId,
        ...(body.data.healthDomainSurfacePolicy !== undefined
          ? { healthDomainSurfacePolicy: body.data.healthDomainSurfacePolicy }
          : {}),
        ...(body.data.financeDomainSurfacePolicy !== undefined
          ? { financeDomainSurfacePolicy: body.data.financeDomainSurfacePolicy }
          : {}),
        ...(body.data.watchSensitiveDetailOptIn !== undefined
          ? { watchSensitiveDetailOptIn: body.data.watchSensitiveDetailOptIn }
          : {}),
      },
      update: {
        ...(body.data.healthDomainSurfacePolicy !== undefined
          ? { healthDomainSurfacePolicy: body.data.healthDomainSurfacePolicy }
          : {}),
        ...(body.data.financeDomainSurfacePolicy !== undefined
          ? { financeDomainSurfacePolicy: body.data.financeDomainSurfacePolicy }
          : {}),
        ...(body.data.watchSensitiveDetailOptIn !== undefined
          ? { watchSensitiveDetailOptIn: body.data.watchSensitiveDetailOptIn }
          : {}),
      },
    });
    return reply.send({ settings });
  });

  app.post('/policy/evaluate', async (req, reply) => {
    const body = evaluateBody.safeParse(req.body ?? {});
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const ctx = await resolveSecurityContext(req);
    const input = {
      ...(body.data.input ?? {}),
      deviceTrust: ctx.edgeDevice?.trustStatus ?? 'TRUSTED',
      watchSensitiveDetailOptIn: (
        await prisma.userSettings.findUnique({ where: { userId: ctx.userId } })
      )?.watchSensitiveDetailOptIn,
    };
    const out = await evaluatePolicyAndLog({
      userId: ctx.userId,
      sourceEntityType: body.data.sourceEntityType,
      sourceEntityId: body.data.sourceEntityId,
      decisionArea: body.data.decisionArea as PolicyDecisionArea,
      input,
    });
    return reply.send(out);
  });

  app.get('/policy/decision-logs', async (req, reply) => {
    const ctx = await resolveSecurityContext(req);
    const { page, pageSize, skip } = parsePagination(req);
    const where = { userId: ctx.userId };
    const [total, data] = await Promise.all([
      prisma.policyDecisionLog.count({ where }),
      prisma.policyDecisionLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);
    return reply.send({ data, meta: buildPaginatedMeta(total, page, pageSize) });
  });
}
