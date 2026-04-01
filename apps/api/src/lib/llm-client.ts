import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { LlmRuntimeConfig } from './llm-config.js';
import { loadLlmConfig } from './llm-config.js';

/** Strips unknown keys (Ollama adds many); validates known fields. */
const ollamaChatResponseSchema = z.object({
  message: z
    .object({
      role: z.string().optional(),
      content: z.string().optional(),
    })
    .optional(),
  model: z.string().optional(),
  eval_count: z.number().optional(),
});

/**
 * OpenAI-style message shape for Ollama `/api/chat`.
 */
export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type OllamaChatResult = {
  text: string;
  model: string;
  latencyMs: number;
  promptHash: string;
  tokenCount?: number;
};

function hashPrompt(messages: ChatMessage[]): string {
  return createHash('sha256').update(JSON.stringify(messages)).digest('hex').slice(0, 16);
}

/**
 * Non-streaming chat completion against local Ollama.
 * Returns `null` when disabled, misconfigured, or on HTTP/network failure.
 */
export async function ollamaChat(
  messages: ChatMessage[],
  options?: {
    config?: LlmRuntimeConfig;
    model?: string;
    maxTokens?: number;
    signal?: AbortSignal;
  },
): Promise<OllamaChatResult | null> {
  const cfg = options?.config ?? loadLlmConfig();
  if (!cfg.llmEnabled) return null;

  const model = options?.model ?? cfg.llmTier2Model;
  const url = `${cfg.ollamaBaseUrl}/api/chat`;
  const promptHash = hashPrompt(messages);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), cfg.ollamaTimeoutMs);
  if (options?.signal) {
    options.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  const started = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        options: options?.maxTokens != null ? { num_predict: options.maxTokens } : undefined,
      }),
    });
    const latencyMs = Date.now() - started;
    if (!res.ok) {
      return null;
    }
    const rawJson: unknown = await res.json();
    const parsed = ollamaChatResponseSchema.safeParse(rawJson);
    if (!parsed.success) {
      return null;
    }
    const data = parsed.data;
    const text = data.message?.content?.trim() ?? '';
    const tokenCount = typeof data.eval_count === 'number' ? data.eval_count : undefined;
    return {
      text,
      model: data.model ?? model,
      latencyMs,
      promptHash,
      tokenCount,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
