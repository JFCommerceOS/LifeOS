import { prisma } from '@life-os/database';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { getUserId } from '../../lib/user.js';
import { mediateSuggestion } from '../../services/assistant-mediation-service.js';
import { ensureDefaultSurfacePolicies, listSurfacePolicies } from '../../services/surface-orchestration-service.js';

const sensitivityClassSchema = z.enum(['safe', 'moderate', 'high', 'very_high']);

const mediateBody = z
  .object({
    sourceEntityType: z.string().min(1),
    sourceEntityId: z.string().min(1),
    rank: z.number(),
    confidence: z.number().min(0).max(1),
    trustScore: z.number().min(0).max(1).optional(),
    sensitivityClass: sensitivityClassSchema.optional(),
    dismissCount: z.number().int().min(0).max(50).optional(),
  })
  .strict();

const patchPolicyBody = z
  .object({
    privacyMode: z.string().optional(),
    urgencyThreshold: z.number().min(0).max(1).optional(),
    interruptionLimit: z.number().int().min(0).max(500).optional(),
    contentDensity: z.string().optional(),
    active: z.boolean().optional(),
  })
  .strict();

async function sendMediationLog(reply: FastifyReply, userId: string, logId: string) {
  const log = await prisma.assistantMediationLog.findFirst({
    where: { id: logId, userId },
  });
  if (!log) {
    return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Mediation decision not found' } });
  }
  return reply.send({ decision: log });
}

export async function registerAssistantRoutes(app: FastifyInstance) {
  app.get('/assistant/mediation-logs/:logId', async (req, reply) => {
    const userId = await getUserId();
    const { logId } = req.params as { logId: string };
    return sendMediationLog(reply, userId, logId);
  });

  /** Blueprint alias — same payload as `GET /assistant/mediation-logs/:logId`. */
  app.get('/assistant/decisions/:logId', async (req, reply) => {
    const userId = await getUserId();
    const { logId } = req.params as { logId: string };
    return sendMediationLog(reply, userId, logId);
  });

  app.get('/assistant/mediation-logs', async (req, reply) => {
    const userId = await getUserId();
    const q = z
      .object({ limit: z.coerce.number().int().min(1).max(200).optional() })
      .safeParse(req.query ?? {});
    const limit = q.success ? (q.data.limit ?? 50) : 50;
    const logs = await prisma.assistantMediationLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return reply.send({ logs });
  });

  app.post('/assistant/mediate', async (req, reply) => {
    const userId = await getUserId();
    const body = mediateBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const result = await mediateSuggestion({ userId, ...body.data });
    return reply.send(result);
  });

  const sendSurfacePolicies = async (_req: FastifyRequest, reply: FastifyReply) => {
    const userId = await getUserId();
    await ensureDefaultSurfacePolicies(userId);
    const policies = await listSurfacePolicies(userId);
    return reply.send({ policies });
  };

  app.get('/surface-policies', sendSurfacePolicies);
  /** Blueprint alias — same payload as `/surface-policies`. */
  app.get('/surfaces/policies', sendSurfacePolicies);

  app.patch('/surface-policies/:id', async (req, reply) => {
    const userId = await getUserId();
    const id = (req.params as { id: string }).id;
    const body = patchPolicyBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const existing = await prisma.surfaceDeliveryPolicy.findFirst({ where: { id, userId } });
    if (!existing) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Policy not found' } });
    const policy = await prisma.surfaceDeliveryPolicy.update({
      where: { id },
      data: body.data,
    });
    return reply.send({ policy });
  });
}
