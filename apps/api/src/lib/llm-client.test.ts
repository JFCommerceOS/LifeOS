import { afterEach, describe, expect, it, vi } from 'vitest';
import { ollamaChat } from './llm-client.js';

describe('ollamaChat', () => {
  const prev = process.env;

  afterEach(() => {
    process.env = { ...prev };
    vi.restoreAllMocks();
  });

  it('returns null when message has wrong type (Zod validation)', async () => {
    process.env.LLM_ENABLED = 'true';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ message: 'not-an-object', model: 'x' }),
      }),
    );
    const r = await ollamaChat([{ role: 'user', content: 'hi' }]);
    expect(r).toBeNull();
  });

  it('returns parsed message when Ollama shape is valid', async () => {
    process.env.LLM_ENABLED = 'true';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          message: { role: 'assistant', content: ' Hello ' },
          model: 'qwen2.5:7b',
          eval_count: 12,
        }),
      }),
    );
    const r = await ollamaChat([{ role: 'user', content: 'hi' }]);
    expect(r).not.toBeNull();
    expect(r!.text).toBe('Hello');
    expect(r!.model).toBe('qwen2.5:7b');
    expect(r!.tokenCount).toBe(12);
  });
});
