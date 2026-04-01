import { randomUUID } from 'node:crypto';
import { prisma } from '@life-os/database';
import type { ExportFormat } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getUserId } from '../../lib/user.js';
import { parsePagination } from '../../lib/pagination.js';
import { resolveSecurityContext } from '../../lib/security-context.js';
import { evaluatePolicyAndLog } from '../../services/policy-engine-service.js';
import { createAndRunExportJob } from '../../services/export-job-service.js';
import { writeSecurityAuditLog } from '../../services/security-audit-service.js';
import { buildPaginatedMeta } from '@life-os/shared';

const exportBody = z
  .object({
    exportScope: z.string().max(200).optional(),
    includeSensitive: z.boolean().optional(),
    format: z.enum(['json', 'markdown']).optional(),
    encrypt: z.boolean().optional(),
  })
  .strict();

const purgeBody = z.object({ scope: z.string().max(200).optional() }).strict();

export async function registerHardeningSecurityRoutes(app: FastifyInstance) {
  app.post('/security/export', async (req, reply) => {
    const body = exportBody.safeParse(req.body ?? {});
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const ctx = await resolveSecurityContext(req);
    const includeSensitive = body.data.includeSensitive ?? false;
    const encrypt = body.data.encrypt ?? false;

    const deviceTrust = ctx.edgeDevice?.trustStatus ?? 'TRUSTED';
    const evalId = randomUUID();
    const policy = await evaluatePolicyAndLog({
      userId: ctx.userId,
      sourceEntityType: 'ExportJob',
      sourceEntityId: evalId,
      decisionArea: 'EXPORT',
      input: {
        domainClass: includeSensitive ? 'FINANCE' : 'GENERAL',
        includeSensitive,
        deviceTrust,
      },
    });
    if (policy.decisionResult === 'BLOCK') {
      await writeSecurityAuditLog({
        userId: ctx.userId,
        edgeDeviceId: ctx.edgeDevice?.id,
        eventType: 'export_blocked',
        eventSummary: 'Export blocked by policy',
        severity: 'warning',
        meta: { reasonCode: policy.reasonCode },
      });
      return reply.status(403).send({
        error: { code: 'POLICY_BLOCK', message: policy.reasonCode },
      });
    }

    const encryptionMode =
      encrypt || includeSensitive ? 'AES256_GCM_DEV' : 'NONE';

    const job = await createAndRunExportJob(
      ctx.userId,
      body.data.exportScope ?? 'standard',
      includeSensitive,
      (body.data.format as ExportFormat) ?? 'json',
      { encryptionMode },
    );

    await writeSecurityAuditLog({
      userId: ctx.userId,
      edgeDeviceId: ctx.edgeDevice?.id,
      eventType: 'export_created',
      eventSummary: `Export job ${job.id}`,
      meta: { encryptionMode, includeSensitive },
    });

    return reply.status(201).send({ job });
  });

  app.get('/security/export-jobs', async (req, reply) => {
    const userId = await getUserId();
    const { page, pageSize, skip } = parsePagination(req);
    const where = { userId };
    const [total, data] = await Promise.all([
      prisma.exportJob.count({ where }),
      prisma.exportJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          exportScope: true,
          includeSensitive: true,
          format: true,
          status: true,
          encryptionMode: true,
          expiresAt: true,
          downloadedAt: true,
          createdAt: true,
          completedAt: true,
        },
      }),
    ]);
    return reply.send({ data, meta: buildPaginatedMeta(total, page, pageSize) });
  });

  app.post('/security/purge', async (req, reply) => {
    const body = purgeBody.safeParse(req.body ?? {});
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const ctx = await resolveSecurityContext(req);
    await writeSecurityAuditLog({
      userId: ctx.userId,
      edgeDeviceId: ctx.edgeDevice?.id,
      eventType: 'purge_requested',
      eventSummary: body.data.scope ?? 'default',
      severity: 'warning',
    });
    return reply.send({ ok: true, note: 'purge_jobs_execute_via_existing_privacy_purge_routes' });
  });

  app.get('/security/audit', async (req, reply) => {
    const ctx = await resolveSecurityContext(req);
    const { page, pageSize, skip } = parsePagination(req);
    const where = { userId: ctx.userId };
    const [total, data] = await Promise.all([
      prisma.securityAuditLog.count({ where }),
      prisma.securityAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);
    return reply.send({ data, meta: buildPaginatedMeta(total, page, pageSize) });
  });
}
