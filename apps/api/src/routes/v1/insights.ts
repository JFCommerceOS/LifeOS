import type { FastifyInstance } from 'fastify';
import { getUserId } from '../../lib/user.js';
import { buildLifestyleInsights, buildRoutineInsights } from '../../lib/phase5-lifestyle.js';
import { buildFinancialInsights, buildPatternInsights } from '../../lib/pattern-insights.js';

export async function registerInsightRoutes(app: FastifyInstance) {
  app.get('/insights/patterns', async (_req, reply) => {
    const userId = await getUserId();
    const insights = await buildPatternInsights(userId);
    return reply.send(insights);
  });

  app.get('/insights/financial', async (_req, reply) => {
    const userId = await getUserId();
    const insights = await buildFinancialInsights(userId);
    return reply.send(insights);
  });

  app.get('/insights/lifestyle', async (_req, reply) => {
    const userId = await getUserId();
    const insights = await buildLifestyleInsights(userId);
    return reply.send(insights);
  });

  app.get('/insights/routine', async (_req, reply) => {
    const userId = await getUserId();
    const insights = await buildRoutineInsights(userId);
    return reply.send(insights);
  });
}
