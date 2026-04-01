import { afterEach, describe, expect, it } from 'vitest';
import { loadLlmConfig } from './llm-config.js';

describe('loadLlmConfig', () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env = { ...prev };
  });

  it('defaults LLM and ASFLC to disabled', () => {
    delete process.env.LLM_ENABLED;
    delete process.env.ASFLC_ENABLED;
    const c = loadLlmConfig();
    expect(c.llmEnabled).toBe(false);
    expect(c.asflcEnabled).toBe(false);
  });

  it('parses truthy LLM_ENABLED', () => {
    process.env.LLM_ENABLED = 'true';
    expect(loadLlmConfig().llmEnabled).toBe(true);
  });

  it('normalizes OLLAMA_BASE_URL trailing slash', () => {
    process.env.OLLAMA_BASE_URL = 'http://127.0.0.1:11434/';
    expect(loadLlmConfig().ollamaBaseUrl).toBe('http://127.0.0.1:11434');
  });
});
