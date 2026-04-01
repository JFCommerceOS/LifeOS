import { prisma } from '@life-os/database';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { TILE_MODES_ORDER, type TileMode } from '@life-os/types';
import { writeAudit } from '../../lib/audit.js';
import { getUserId } from '../../lib/user.js';
import { buildTileDisplayModel, cycleTileMode } from '../../services/tile-presentation.js';

const actionBody = z
  .object({
    action: z.enum(['acknowledge', 'snooze', 'cycle_mode', 'open_on_phone', 'clear_manual_mode']),
    suggestionId: z.string().optional(),
  })
  .strict();

function isTileMode(s: string | null | undefined): s is TileMode {
  return Boolean(s && TILE_MODES_ORDER.includes(s as TileMode));
}

export async function registerSurfaceTileRoutes(app: FastifyInstance) {
  app.get('/surfaces/tile/current', async (_req, reply) => {
    const userId = await getUserId();
    const tile = await buildTileDisplayModel(userId);
    return reply.send(tile);
  });

  app.get('/surfaces/tile/modes', async (_req, reply) => {
    const userId = await getUserId();
    const tile = await buildTileDisplayModel(userId);
    const settings = await prisma.userSettings.findUnique({ where: { userId } });
    return reply.send({
      supported: TILE_MODES_ORDER,
      effectiveMode: tile.mode,
      manualOverride: isTileMode(settings?.ambientTileManualMode)
        ? settings!.ambientTileManualMode
        : null,
    });
  });

  app.post('/surfaces/tile/action', async (req, reply) => {
    const userId = await getUserId();
    const body = actionBody.safeParse(req.body);
    if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

    const { action, suggestionId } = body.data;

    if (action === 'acknowledge') {
      await writeAudit(userId, 'tile.action', {
        meta: { action: 'acknowledge', suggestionId: suggestionId ?? null },
      });
      return reply.send({ ok: true });
    }

    if (action === 'open_on_phone') {
      await writeAudit(userId, 'tile.action', { meta: { action: 'open_on_phone' } });
      return reply.send({ ok: true, handoff: 'Use Life OS on phone or web for full context.' });
    }

    if (action === 'clear_manual_mode') {
      await prisma.userSettings.update({
        where: { userId },
        data: { ambientTileManualMode: null },
      });
      await writeAudit(userId, 'tile.action', { meta: { action: 'clear_manual_mode' } });
      const tile = await buildTileDisplayModel(userId);
      return reply.send({ ok: true, tile });
    }

    if (action === 'cycle_mode') {
      const current = await buildTileDisplayModel(userId);
      const nextMode = cycleTileMode(current.mode);
      await prisma.userSettings.update({
        where: { userId },
        data: { ambientTileManualMode: nextMode },
      });
      await writeAudit(userId, 'tile.action', { meta: { action: 'cycle_mode', nextMode } });
      const tile = await buildTileDisplayModel(userId);
      return reply.send({ ok: true, nextMode, tile });
    }

    if (action === 'snooze') {
      if (!suggestionId) {
        return reply.status(400).send({ error: 'suggestionId required for snooze' });
      }
      const existing = await prisma.suggestion.findFirst({ where: { id: suggestionId, userId } });
      if (!existing) return reply.status(404).send({ error: 'Suggestion not found' });
      if (existing.state !== 'pending' && existing.state !== 'snoozed') {
        return reply.status(409).send({ error: 'Snooze not allowed for this state' });
      }
      const snoozeUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await prisma.suggestion.update({
        where: { id: suggestionId },
        data: { state: 'snoozed', snoozedUntil: snoozeUntil },
      });
      await writeAudit(userId, 'tile.action', {
        entityType: 'Suggestion',
        entityId: suggestionId,
        meta: { action: 'snooze', snoozeUntil: snoozeUntil.toISOString() },
      });
      const tile = await buildTileDisplayModel(userId);
      return reply.send({ ok: true, tile });
    }

    return reply.status(500).send({ error: 'Unhandled' });
  });
}
