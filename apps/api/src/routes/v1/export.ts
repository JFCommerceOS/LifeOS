import { ExportFormat } from '@prisma/client';
import { prisma } from '@life-os/database';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { writeAudit } from '../../lib/audit.js';
import { getUserId } from '../../lib/user.js';
import { parsePagination } from '../../lib/pagination.js';
import { buildPaginatedMeta } from '@life-os/shared';
import { createAndRunExportJob } from '../../services/export-job-service.js';

const exportPostBody = z
  .object({
    exportScope: z.string().max(200).default('standard'),
    includeSensitive: z.boolean().default(false),
    format: z.enum(['json', 'markdown']).default('json'),
  })
  .strict();

/**
 * Legacy instant download + Sprint 09 export jobs.
 */
export async function registerExportRoutes(app: FastifyInstance) {
  app.post('/exports', async (req, reply) => {
    const userId = await getUserId();
    const body = exportPostBody.safeParse(req.body ?? {});
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const job = await createAndRunExportJob(
      userId,
      body.data.exportScope ?? 'standard',
      body.data.includeSensitive ?? false,
      body.data.format ?? ExportFormat.json,
    );
    await writeAudit(userId, 'export.job', { entityId: job.id, meta: { format: body.data.format } });
    return reply.status(201).send({ job });
  });

  app.get('/exports', async (req, reply) => {
    const userId = await getUserId();
    const { page, pageSize, skip } = parsePagination(req);
    const [total, jobs] = await Promise.all([
      prisma.exportJob.count({ where: { userId } }),
      prisma.exportJob.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          exportScope: true,
          includeSensitive: true,
          format: true,
          status: true,
          createdAt: true,
          completedAt: true,
        },
      }),
    ]);
    return reply.send({ data: jobs, meta: buildPaginatedMeta(page, pageSize, total) });
  });

  app.get('/exports/:exportId', async (req, reply) => {
    const userId = await getUserId();
    const exportId = z.string().parse((req.params as { exportId: string }).exportId);
    const job = await prisma.exportJob.findFirst({ where: { id: exportId, userId } });
    if (!job) return reply.status(404).send({ error: { code: 'NOT_FOUND' } });
    return reply.send({ job });
  });

  app.post('/privacy/export', async (_req, reply) => {
    const userId = await getUserId();
    const [user, settings, obligations, notes, suggestions] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.userSettings.findUnique({ where: { userId } }),
      prisma.obligation.findMany({ where: { userId }, take: 500 }),
      prisma.note.findMany({ where: { userId, archivedAt: null }, take: 500 }),
      prisma.suggestion.findMany({ where: { userId }, take: 200, include: { evidence: true } }),
    ]);

    const snapshot = {
      exportedAt: new Date().toISOString(),
      version: 1,
      user,
      settings,
      obligations,
      notes,
      suggestions,
    };

    await writeAudit(userId, 'privacy.export', { meta: { kind: 'json_snapshot' } });

    return reply
      .header('Content-Type', 'application/json')
      .header('Content-Disposition', 'attachment; filename="life-os-export.json"')
      .send(JSON.stringify(snapshot, null, 2));
  });
}
