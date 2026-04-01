# A-S-FLC sidecar (Life OS)

Python **FastAPI** service: deterministic **policy guard** (`POST /guard`) and optional **`POST /decide`** (security JSON via Ollama).

## Prerequisites

- Python 3.11+
- [Ollama](https://ollama.com) installed and running
- Your fine-tuned GGUF registered as an Ollama model (see below)

## 1. Register the GGUF in Ollama

Create a `Modelfile` next to your `.gguf` (adjust the `FROM` path):

```dockerfile
FROM "D:/Qwen Agent/Qwen2.5-1.5B-Instruct.Q4_K_M (1).gguf"
```

Then:

```bash
ollama create asflc-decision -f Modelfile
```

Name must match `ASFLC_OLLAMA_MODEL` (default `asflc-decision`).

## 2. Tier 2 model (brief explanations)

```bash
ollama pull qwen2.5:7b
```

## 3. Install and run the sidecar

From the repo root (after `pip install -r requirements.txt` inside `apps/asflc-sidecar`):

```bash
pnpm asflc-sidecar
```

Or manually:

```bash
cd apps/asflc-sidecar
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
set OLLAMA_BASE_URL=http://127.0.0.1:11434
set ASFLC_OLLAMA_MODEL=asflc-decision
uvicorn main:app --host 127.0.0.1 --port 8100
```

Health: `GET http://127.0.0.1:8100/health`

The Life OS API also exposes `GET /api/v1/health/llm`, which probes Ollama (`/api/tags`) and this sidecar (`/health`) for the Settings page.

## 4. Life OS `.env`

Set `ASFLC_ENABLED=true` and/or `LLM_ENABLED=true` after Ollama and this sidecar are running. See repo root `.env.example`.
