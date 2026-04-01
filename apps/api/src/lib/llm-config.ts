function parseBool(v: string | undefined, defaultValue: boolean): boolean {
  if (v === undefined || v === '') return defaultValue;
  const x = v.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(x)) return true;
  if (['0', 'false', 'no', 'off'].includes(x)) return false;
  return defaultValue;
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

export type LlmRuntimeConfig = {
  ollamaBaseUrl: string;
  /** Tier 2 general-assistance model name in Ollama (e.g. `qwen2.5:7b`). */
  llmTier2Model: string;
  /** When true, Tier 2 routes may call Ollama. */
  llmEnabled: boolean;
  /** A-S-FLC Python sidecar (policy guard + optional decide). */
  asflcSidecarUrl: string;
  /** When true, signal intake may call the sidecar guard. */
  asflcEnabled: boolean;
  /** Tier 1 fine-tuned model name in Ollama (create via Modelfile). */
  asflcOllamaModel: string;
  ollamaTimeoutMs: number;
  asflcTimeoutMs: number;
};

export function loadLlmConfig(): LlmRuntimeConfig {
  return {
    ollamaBaseUrl: normalizeBaseUrl(process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434'),
    llmTier2Model: process.env.LLM_TIER2_MODEL ?? 'qwen2.5:7b',
    llmEnabled: parseBool(process.env.LLM_ENABLED, false),
    asflcSidecarUrl: normalizeBaseUrl(process.env.ASFLC_SIDECAR_URL ?? 'http://127.0.0.1:8100'),
    asflcEnabled: parseBool(process.env.ASFLC_ENABLED, false),
    asflcOllamaModel: process.env.ASFLC_OLLAMA_MODEL ?? 'asflc-decision',
    ollamaTimeoutMs: Math.min(120_000, Math.max(5_000, Number(process.env.OLLAMA_TIMEOUT_MS ?? '45000') || 45_000)),
    asflcTimeoutMs: Math.min(120_000, Math.max(3_000, Number(process.env.ASFLC_TIMEOUT_MS ?? '30000') || 30_000)),
  };
}
