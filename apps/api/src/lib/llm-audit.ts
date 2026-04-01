import type { FastifyBaseLogger } from 'fastify';
import pino from 'pino';

export type LlmAuditPayload = {
  tier: 1 | 2;
  route: string;
  model?: string;
  latencyMs: number;
  promptHash?: string;
  /** When false, sidecar or Ollama was down — request continued without blocking. */
  ok?: boolean;
  /** Ollama `eval_count` when present. */
  tokenCount?: number;
};

const fallbackLogger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

/**
 * Structured audit log for local LLM calls (no raw prompts by default).
 * Uses Fastify request logger when available; otherwise a module-level pino (e.g. signal intake).
 */
export function logLlmInvocation(log: FastifyBaseLogger | undefined, payload: LlmAuditPayload): void {
  (log ?? fallbackLogger).info({ llm: payload }, 'llm_invocation');
}
