import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';

describe('app', () => {
  it('GET /health returns ok', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ ok: true });
    await app.close();
  });

  it('GET /api/v1/health returns service payload', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { ok: boolean; service: string };
    expect(body.ok).toBe(true);
    expect(body.service).toBe('life-os-api');
    await app.close();
  });

  it('GET /api/v1/health/llm returns tier1/tier2 shape', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/v1/health/llm' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      tier2: { enabled: boolean; ollamaReachable: boolean; model: string };
      tier1: { enabled: boolean; sidecarReachable: boolean };
    };
    expect(typeof body.tier2.enabled).toBe('boolean');
    expect(typeof body.tier2.ollamaReachable).toBe('boolean');
    expect(typeof body.tier2.model).toBe('string');
    expect(typeof body.tier1.enabled).toBe('boolean');
    expect(typeof body.tier1.sidecarReachable).toBe('boolean');
    await app.close();
  });

  it('unknown route returns JSON error envelope', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/api/v1/no-such-route-ever' });
    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body) as { error: { code: string } };
    expect(body.error.code).toBe('NOT_FOUND');
    await app.close();
  });
});
