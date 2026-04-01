import { prisma } from '@life-os/database';
import { SignalProcessingStatus, SignalSourceType, SignalType } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { writeAudit } from '../../lib/audit.js';
import { getUserId } from '../../lib/user.js';
import { parsePagination } from '../../lib/pagination.js';
import { buildPaginatedMeta } from '@life-os/shared';
import { intakeSignal } from '../../services/signal-intake-service.js';

const intakeBody = z.object({
  signalType: z.nativeEnum(SignalType),
  sourceType: z.nativeEnum(SignalSourceType),
  rawPayloadJson: z.union([z.string().min(1), z.record(z.unknown())]),
  sourceConnectorId: z.string().nullable().optional(),
  sourceRecordId: z.string().nullable().optional(),
  occurredAt: z.string().datetime().nullable().optional(),
  languageCode: z.string().min(2).max(16).nullable().optional(),
  privacyClass: z.enum(['low', 'medium', 'high']).nullable().optional(),
  trustLevel: z.number().int().min(0).max(100).nullable().optional(),
});

export async function registerSignalRoutes(app: FastifyInstance) {
  app.post('/signals/intake', async (req, reply) => {
    const userId = await getUserId();
    const parsed = intakeBody.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() });

    const rawPayloadJson =
      typeof parsed.data.rawPayloadJson === 'string'
        ? parsed.data.rawPayloadJson
        : JSON.stringify(parsed.data.rawPayloadJson);

    try {
      const envelope = await intakeSignal({
        userId,
        signalType: parsed.data.signalType,
        sourceType: parsed.data.sourceType,
        rawPayloadJson,
        sourceConnectorId: parsed.data.sourceConnectorId,
        sourceRecordId: parsed.data.sourceRecordId,
        occurredAt: parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : null,
        languageCode: parsed.data.languageCode,
        privacyClass: parsed.data.privacyClass,
        trustLevel: parsed.data.trustLevel,
      });

      await writeAudit(userId, 'signal.intake', {
        entityType: 'SignalEnvelope',
        entityId: envelope.id,
        meta: { signalType: envelope.signalType, status: envelope.processingStatus },
      });

      return reply.status(201).send({ signal: envelope });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Intake failed';
      return reply.status(400).send({ error: { message: msg, code: 'SIGNAL_INTAKE_FAILED' } });
    }
  });

  app.get('/signals', async (req, reply) => {
    const userId = await getUserId();
    const { page, pageSize, skip } = parsePagination(req);

    const status = z.nativeEnum(SignalProcessingStatus).optional().safeParse(
      (req.query as { status?: string }).status,
    );

    const where = {
      userId,
      ...(status.success && status.data ? { processingStatus: status.data } : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.signalEnvelope.count({ where }),
      prisma.signalEnvelope.findMany({
        where,
        orderBy: { receivedAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          signalType: true,
          sourceType: true,
          processingStatus: true,
          contentHash: true,
          receivedAt: true,
          occurredAt: true,
          languageCode: true,
          trustLevel: true,
        },
      }),
    ]);

    return reply.send({
      data: rows,
      meta: buildPaginatedMeta(page, pageSize, total),
    });
  });

  app.get('/signals/:signalId', async (req, reply) => {
    const userId = await getUserId();
    const signalId = z.string().parse((req.params as { signalId: string }).signalId);
    const signal = await prisma.signalEnvelope.findFirst({
      where: { id: signalId, userId },
      include: {
        normalizedRecord: true,
        extractedFacts: { orderBy: { createdAt: 'asc' } },
        processingLogs: { orderBy: { createdAt: 'asc' } },
        sourceObligations: {
          include: { _count: { select: { evidenceItems: true } } },
        },
      },
    });
    if (!signal) return reply.status(404).send({ error: { message: 'Not found', code: 'NOT_FOUND' } });
    return reply.send({ signal });
  });

  app.get('/signals/:signalId/processing', async (req, reply) => {
    const userId = await getUserId();
    const signalId = z.string().parse((req.params as { signalId: string }).signalId);
    const parent = await prisma.signalEnvelope.findFirst({
      where: { id: signalId, userId },
      select: { id: true },
    });
    if (!parent) return reply.status(404).send({ error: { message: 'Not found', code: 'NOT_FOUND' } });

    const logs = await prisma.signalProcessingLog.findMany({
      where: { signalId },
      orderBy: { createdAt: 'asc' },
    });
    return reply.send({ logs });
  });

  app.get('/signals/:signalId/facts', async (req, reply) => {
    const userId = await getUserId();
    const signalId = z.string().parse((req.params as { signalId: string }).signalId);
    const parent = await prisma.signalEnvelope.findFirst({
      where: { id: signalId, userId },
      select: { id: true },
    });
    if (!parent) return reply.status(404).send({ error: { message: 'Not found', code: 'NOT_FOUND' } });

    const facts = await prisma.extractedFact.findMany({
      where: { signalId },
      orderBy: { createdAt: 'asc' },
    });
    return reply.send({ facts });
  });

  app.get('/signals/:signalId/evidence', async (req, reply) => {
    const userId = await getUserId();
    const signalId = z.string().parse((req.params as { signalId: string }).signalId);
    const parent = await prisma.signalEnvelope.findFirst({
      where: { id: signalId, userId },
      select: { id: true },
    });
    if (!parent) return reply.status(404).send({ error: { message: 'Not found', code: 'NOT_FOUND' } });

    const evidenceFacts = await prisma.extractedFact.findMany({
      where: { signalId, evidenceExcerpt: { not: null } },
      orderBy: { createdAt: 'asc' },
    });
    return reply.send({ facts: evidenceFacts });
  });
}
