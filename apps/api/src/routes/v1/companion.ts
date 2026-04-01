import { prisma } from '@life-os/database';
import type { FastifyInstance } from 'fastify';
import { getUserId } from '../../lib/user.js';

/** Minimal payload for watch / glance clients. */
export async function registerCompanionRoutes(app: FastifyInstance) {
  /** Watch-only surface: due-now + one suggestion handle + counts — no archive. */
  app.get('/companion/watch', async (_req, reply) => {
    const userId = await getUserId();
    const now = new Date();
    const [dueNow, topSuggestion, pendingCount, snippetRow] = await Promise.all([
      prisma.obligation.findFirst({
        where: {
          userId,
          status: 'open',
          dueAt: { lte: new Date(now.getTime() + 24 * 60 * 60 * 1000) },
        },
        orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
        select: { id: true, title: true, dueAt: true },
      }),
      prisma.suggestion.findFirst({
        where: { userId, state: 'pending' },
        orderBy: [{ rank: 'desc' }, { createdAt: 'desc' }],
        select: { id: true, title: true, reason: true },
      }),
      prisma.suggestion.count({ where: { userId, state: 'pending' } }),
      prisma.dailyBrief.findFirst({
        where: { userId },
        orderBy: { day: 'desc' },
        include: {
          items: { orderBy: { sortOrder: 'asc' }, take: 1, select: { title: true, oneLine: true } },
        },
      }),
    ]);

    const briefLine =
      snippetRow?.items[0]?.oneLine ??
      snippetRow?.items[0]?.title ??
      (dueNow ? `Next: ${dueNow.title}` : 'No items yet');

    return reply.send({
      surface: 'watch' as const,
      dueNow,
      suggestion: topSuggestion
        ? { id: topSuggestion.id, title: topSuggestion.title, oneLine: topSuggestion.reason }
        : null,
      pendingSuggestions: pendingCount,
      briefLine,
    });
  });

  app.get('/companion/glance', async (_req, reply) => {
    const userId = await getUserId();
    const [topObligations, latestBrief] = await Promise.all([
      prisma.obligation.findMany({
        where: { userId, status: 'open' },
        orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
        take: 5,
        select: { id: true, title: true, dueAt: true },
      }),
      prisma.dailyBrief.findFirst({
        where: { userId },
        orderBy: { day: 'desc' },
        include: {
          items: { orderBy: { sortOrder: 'asc' }, take: 7, select: { id: true, title: true, bucket: true, oneLine: true } },
        },
      }),
    ]);

    const oneLine =
      latestBrief?.items[0]?.oneLine ??
      latestBrief?.items[0]?.title ??
      (topObligations[0] ? `Next: ${topObligations[0].title}` : 'No items yet');

    return reply.send({
      date: latestBrief?.day ?? new Date().toISOString().slice(0, 10),
      topObligations,
      briefSnippet: oneLine,
    });
  });
}
