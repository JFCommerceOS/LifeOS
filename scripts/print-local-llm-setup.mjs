#!/usr/bin/env node
/**
 * Prints hybrid local LLM setup steps (Ollama + A-S-FLC sidecar).
 * Does not install software — follow the printed commands on your machine.
 */
const lines = [
  'Life OS — hybrid local LLM setup (Option E)',
  '',
  '1) Install Ollama: https://ollama.com/download',
  '2) Register your A-S-FLC GGUF (adjust path):',
  '     ollama create asflc-decision -f apps/asflc-sidecar/Modelfile.example',
  '   Or copy Modelfile.example to Modelfile, set FROM to your .gguf path, then:',
  '     ollama create asflc-decision -f Modelfile',
  '3) Tier 2 model:',
  '     ollama pull qwen2.5:7b',
  '4) Python sidecar (from repo root):',
  '     cd apps/asflc-sidecar && python -m venv .venv && pip install -r requirements.txt',
  '     pnpm asflc-sidecar',
  '5) Root .env (see .env.example):',
  '     LLM_ENABLED=true  ASFLC_ENABLED=true',
  '6) Apply DB migration for LlmInvocationLog: pnpm db:migrate:deploy',
  '',
];
console.log(lines.join('\n'));
