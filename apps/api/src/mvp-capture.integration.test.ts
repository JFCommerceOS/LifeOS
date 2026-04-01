import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';

const runIntegration = Boolean(process.env.DATABASE_URL || process.env.CI);

/**
 * Requires Postgres + migrations applied (`pnpm db:bootstrap` or CI).
 * Sprint 02: synchronous capture — pipeline completes before 201 response.
 */
describe.skipIf(!runIntegration)('MVP note → signal → obligation (integration)', () => {
  it('POST /notes with follow-up language yields signal, facts, and obligations', async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/notes',
      payload: {
        body: 'Follow up with Sam before Friday — need to reply to Alex by Monday.',
      },
    });
    expect(res.statusCode).toBe(201);

    const body = JSON.parse(res.body) as {
      signal: { id: string; processingStatus: string };
      normalized: { normalizedText: string } | null;
      facts: { factType: string }[];
      obligations: { id: string; reasonSummary: string | null; evidenceCount: number }[];
    };

    expect(body.signal.processingStatus).toBe('context_ready');
    expect(body.normalized?.normalizedText.length).toBeGreaterThan(0);
    expect(body.facts.some((f) => f.factType === 'FOLLOW_UP_CUE')).toBe(true);
    expect(body.obligations.length).toBeGreaterThan(0);
    expect(body.obligations[0]?.reasonSummary).toMatch(/FOLLOW_UP_CUE|DEADLINE_REFERENCE|DATE_REFERENCE/);

    await app.close();
  });
});
