import type { FastifyInstance } from 'fastify';
import { loadLlmConfig } from '../../lib/llm-config.js';

async function probeGet(url: string, timeoutMs: number): Promise<boolean> {
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const r = await fetch(url, { method: 'GET', signal: ac.signal });
    return r.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(to);
  }
}

export async function registerV1HealthRoutes(app: FastifyInstance) {
  app.get('/health', async () => ({
    ok: true as const,
    service: 'life-os-api',
  }));

  /**
   * Reachability of local Ollama and A-S-FLC sidecar (for Settings UI).
   * Does not expose secrets; config flags come from env.
   */
  app.get('/health/llm', async () => {
    const cfg = loadLlmConfig();
    const probeMs = 2500;
    const [ollamaReachable, sidecarReachable] = await Promise.all([
      probeGet(`${cfg.ollamaBaseUrl}/api/tags`, probeMs),
      probeGet(`${cfg.asflcSidecarUrl}/health`, probeMs),
    ]);
    return {
      tier2: {
        enabled: cfg.llmEnabled,
        ollamaReachable,
        model: cfg.llmTier2Model,
      },
      tier1: {
        enabled: cfg.asflcEnabled,
        sidecarReachable,
      },
    };
  });
}
