import { prisma } from '@life-os/database';
import type { LlmAuditPayload } from '../lib/llm-audit.js';

export type PersistLlmPayload = LlmAuditPayload & { tokenCount?: number | null };

/**
 * Best-effort DB row for local LLM / sidecar invocations. Never throws to callers.
 */
export async function persistLlmInvocation(userId: string, payload: PersistLlmPayload): Promise<void> {
  try {
    await prisma.llmInvocationLog.create({
      data: {
        userId,
        tier: payload.tier,
        route: payload.route.slice(0, 500),
        model: payload.model?.slice(0, 200) ?? null,
        latencyMs: Math.min(2_147_483_647, Math.max(0, Math.round(payload.latencyMs))),
        promptHash: payload.promptHash?.slice(0, 128) ?? null,
        ok: payload.ok !== false,
        tokenCount:
          payload.tokenCount != null
            ? Math.min(2_147_483_647, Math.max(0, Math.round(payload.tokenCount)))
            : null,
      },
    });
  } catch {
    // avoid breaking API if audit table missing or DB hiccup
  }
}
