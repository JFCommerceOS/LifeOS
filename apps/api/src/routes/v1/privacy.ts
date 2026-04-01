import { prisma } from '@life-os/database';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { writeAudit } from '../../lib/audit.js';
import { getUserId } from '../../lib/user.js';
import { parsePagination } from '../../lib/pagination.js';
import { buildPaginatedMeta } from '@life-os/shared';
import { getDataLineage } from '../../services/data-lineage-service.js';
import { createAndExecutePrivacyAction, createPrivacyAction, executePrivacyAction } from '../../services/privacy-action-service.js';
import { listRetentionPolicies } from '../../services/retention-policy-service.js';
import { computeStorageInventory, persistInventorySnapshot } from '../../services/storage-inventory-service.js';

const patchBody = z
  .object({
    privacyStrictMode: z.boolean().optional(),
    retentionDays: z.number().int().min(1).max(3650).optional(),
  })
  .strict();

const policyPatchBody = z
  .object({
    retentionClass: z
      .enum([
        'HOT_ACTIVE',
        'WARM_CONTINUITY',
        'SEMANTIC_LONG_LIFE',
        'EVIDENCE_SHORT_LIFE',
        'SENSITIVE_RESTRICTED',
        'EXPORTED_PENDING_DELETION',
        'PURGE_QUEUED',
        'TOMBSTONED',
      ])
      .optional(),
    sensitivityLevel: z.enum(['NORMAL', 'ELEVATED', 'SENSITIVE', 'HIGHLY_SENSITIVE']).optional(),
    retentionDays: z.number().int().min(1).max(3650).nullable().optional(),
    autoPurgeEnabled: z.boolean().optional(),
    defaultActionAfterWindow: z.string().max(200).optional(),
  })
  .strict();

const privacyActionBody = z
  .object({
    actionType: z.enum([
      'EXPORT',
      'DELETE',
      'ARCHIVE',
      'REDACT',
      'PURGE_CONNECTOR',
      'PURGE_CATEGORY',
      'DISCONNECT_AND_PURGE',
      'RETENTION_CHANGE',
    ]),
    targetEntityType: z.string().min(1),
    targetEntityId: z.string().nullable().optional(),
    reason: z.string().max(2000).nullable().optional(),
    execute: z.boolean().optional(),
  })
  .strict();

const redactBody = z
  .object({
    entityType: z.enum(['Note', 'Document']),
    entityId: z.string().min(1),
    mode: z.enum(['strip', 'mask']).optional(),
  })
  .strict();

export async function registerPrivacyRoutes(app: FastifyInstance) {
  app.get('/privacy/inventory', async (_req, reply) => {
    const userId = await getUserId();
    const inventory = await computeStorageInventory(userId);
    return reply.send(inventory);
  });

  app.post('/privacy/inventory/snapshot', async (_req, reply) => {
    const userId = await getUserId();
    const snap = await persistInventorySnapshot(userId);
    await writeAudit(userId, 'privacy.inventory_snapshot', { entityId: snap.id });
    return reply.status(201).send(snap);
  });

  app.get('/privacy/policies', async (_req, reply) => {
    const userId = await getUserId();
    const policies = await listRetentionPolicies(userId);
    return reply.send({ policies });
  });

  app.patch('/privacy/policies/:policyId', async (req, reply) => {
    const userId = await getUserId();
    const policyId = z.string().parse((req.params as { policyId: string }).policyId);
    const body = policyPatchBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const existing = await prisma.dataRetentionPolicy.findFirst({ where: { id: policyId, userId } });
    if (!existing) return reply.status(404).send({ error: { code: 'NOT_FOUND' } });
    const policy = await prisma.dataRetentionPolicy.update({ where: { id: policyId }, data: body.data });
    await writeAudit(userId, 'privacy.policy_patch', { entityId: policyId, meta: body.data });
    return reply.send({ policy });
  });

  app.get('/privacy/actions', async (req, reply) => {
    const userId = await getUserId();
    const { page, pageSize, skip } = parsePagination(req);
    const [total, actions] = await Promise.all([
      prisma.privacyAction.count({ where: { userId } }),
      prisma.privacyAction.findMany({
        where: { userId },
        orderBy: { requestedAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);
    return reply.send({ data: actions, meta: buildPaginatedMeta(page, pageSize, total) });
  });

  app.post('/privacy/actions', async (req, reply) => {
    const userId = await getUserId();
    const body = privacyActionBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    if (body.data.execute) {
      const out = await createAndExecutePrivacyAction({
        userId,
        actionType: body.data.actionType,
        targetEntityType: body.data.targetEntityType,
        targetEntityId: body.data.targetEntityId ?? null,
        reason: body.data.reason,
      });
      await writeAudit(userId, 'privacy.action', {
        entityId: out.action.id,
        meta: { type: body.data.actionType, result: out.result },
      });
      return reply.status(201).send(out);
    }

    const action = await createPrivacyAction({
      userId,
      actionType: body.data.actionType,
      targetEntityType: body.data.targetEntityType,
      targetEntityId: body.data.targetEntityId ?? null,
      reason: body.data.reason,
    });
    await writeAudit(userId, 'privacy.action_requested', { entityId: action.id });
    return reply.status(201).send({ action });
  });

  app.post('/privacy/actions/:actionId/execute', async (req, reply) => {
    const userId = await getUserId();
    const actionId = z.string().parse((req.params as { actionId: string }).actionId);
    const result = await executePrivacyAction(actionId, userId);
    await writeAudit(userId, 'privacy.action_execute', { entityId: actionId, meta: result });
    return reply.send(result);
  });

  app.get('/privacy/lineage', async (req, reply) => {
    const userId = await getUserId();
    const q = z
      .object({ entityType: z.string().min(1), entityId: z.string().min(1) })
      .safeParse((req.query as { entityType?: string; entityId?: string }));
    if (!q.success) return reply.status(400).send({ error: q.error.flatten() });
    const lineage = await getDataLineage(userId, q.data.entityType, q.data.entityId);
    if (!lineage) return reply.status(404).send({ error: { code: 'NOT_FOUND' } });
    return reply.send({ lineage });
  });

  app.post('/privacy/redact', async (req, reply) => {
    const userId = await getUserId();
    const body = redactBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const out = await createAndExecutePrivacyAction({
      userId,
      actionType: 'REDACT',
      targetEntityType: body.data.entityType,
      targetEntityId: body.data.entityId,
      reason: 'user_redact_endpoint',
    });
    await writeAudit(userId, 'privacy.redact', { meta: out });
    return reply.status(201).send(out);
  });

  app.get('/privacy/redaction-rules', async (_req, reply) => {
    const userId = await getUserId();
    const rules = await prisma.redactionRule.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' } });
    return reply.send({ rules });
  });

  app.post('/privacy/redaction-rules', async (req, reply) => {
    const userId = await getUserId();
    const body = z
      .object({
        category: z.string().min(1),
        fieldPath: z.string().min(1),
        ruleType: z.string().min(1),
      })
      .strict()
      .safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const rule = await prisma.redactionRule.create({
      data: { userId, ...body.data },
    });
    await writeAudit(userId, 'privacy.redaction_rule_create', { entityId: rule.id });
    return reply.status(201).send({ rule });
  });

  app.patch('/privacy/redaction-rules/:ruleId', async (req, reply) => {
    const userId = await getUserId();
    const ruleId = z.string().parse((req.params as { ruleId: string }).ruleId);
    const body = z.object({ isEnabled: z.boolean().optional(), ruleType: z.string().optional() }).strict().safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const existing = await prisma.redactionRule.findFirst({ where: { id: ruleId, userId } });
    if (!existing) return reply.status(404).send({ error: { code: 'NOT_FOUND' } });
    const rule = await prisma.redactionRule.update({ where: { id: ruleId }, data: body.data });
    await writeAudit(userId, 'privacy.redaction_rule_patch', { entityId: ruleId });
    return reply.send({ rule });
  });

  app.get('/privacy', async (_req, reply) => {
    const userId = await getUserId();
    const settings = await prisma.userSettings.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
    return reply.send({
      privacyStrictMode: settings.privacyStrictMode,
      retentionDays: settings.retentionDays,
      connectorTogglesJson: settings.connectorTogglesJson,
    });
  });

  app.patch('/privacy', async (req, reply) => {
    const userId = await getUserId();
    const body = patchBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
    const settings = await prisma.userSettings.update({
      where: { userId },
      data: body.data,
    });
    await writeAudit(userId, 'privacy.patch', { meta: body.data });
    return reply.send({
      privacyStrictMode: settings.privacyStrictMode,
      retentionDays: settings.retentionDays,
    });
  });
}
