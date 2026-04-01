import { z } from 'zod';
import type { LlmRuntimeConfig } from './llm-config.js';
import { loadLlmConfig } from './llm-config.js';

const policyResultSchema = z.object({
  allowed: z.boolean(),
  matched_rules: z.array(z.string()).optional(),
  pii_types: z.array(z.string()).optional(),
  block_reason: z.string().optional(),
});

export type PolicyGuardResult = z.infer<typeof policyResultSchema>;

const partialDecisionSchema = z
  .object({
    chosen_action: z.string().optional(),
    risk_level: z.enum(['SAFE', 'SUSPICIOUS', 'DANGEROUS']).nullable().optional(),
    threat_type: z.string().nullable().optional(),
    decision_route: z.string().nullable().optional(),
    pii_detected: z.string().nullable().optional(),
  })
  .passthrough();

export type AsflcDecisionPartial = z.infer<typeof partialDecisionSchema>;

export type DecideResult = {
  valid: boolean;
  output?: AsflcDecisionPartial;
  raw?: string;
  latencyMs: number;
};

/**
 * Deterministic policy guard via A-S-FLC sidecar (`POST /guard`).
 * Returns `null` when disabled or on failure (caller should skip, not block).
 */
export async function asflcGuardCheck(
  text: string,
  options?: { config?: LlmRuntimeConfig; signal?: AbortSignal },
): Promise<PolicyGuardResult | null> {
  const cfg = options?.config ?? loadLlmConfig();
  if (!cfg.asflcEnabled) return null;

  const url = `${cfg.asflcSidecarUrl}/guard`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), cfg.asflcTimeoutMs);
  if (options?.signal) {
    options.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ text: text.slice(0, 48_000) }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const parsed = policyResultSchema.safeParse(json);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Optional JSON decision from A-S-FLC + Ollama (`POST /decide`).
 * Returns `null` when disabled or on failure.
 */
export async function asflcDecide(
  text: string,
  mode: string = 'security',
  options?: { config?: LlmRuntimeConfig; signal?: AbortSignal },
): Promise<DecideResult | null> {
  const cfg = options?.config ?? loadLlmConfig();
  if (!cfg.asflcEnabled) return null;

  const url = `${cfg.asflcSidecarUrl}/decide`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), cfg.asflcTimeoutMs);
  if (options?.signal) {
    options.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  const started = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ text: text.slice(0, 48_000), mode }),
    });
    const latencyMs = Date.now() - started;
    if (!res.ok) return null;
    const json = (await res.json()) as { valid?: boolean; output?: unknown; raw?: string };
    if (!json.valid || !json.output) {
      return { valid: false, raw: json.raw, latencyMs };
    }
    const out = partialDecisionSchema.safeParse(json.output);
    return {
      valid: out.success,
      output: out.success ? out.data : undefined,
      raw: json.raw,
      latencyMs,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
