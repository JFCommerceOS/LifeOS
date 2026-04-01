# Life OS

Local-first **personal continuity** system: obligations, suggestions, daily brief, evidence-backed outputs, and privacy controls. Built as a pnpm monorepo (`apps/web`, `apps/api`, `packages/*`).

- **Remote:** https://github.com/JFCommerceOS/LifeOS.git  
- **Dev host:** primary development is on **Mac mini** per product rules; this repo runs on Windows/macOS/Linux with Node.js + PostgreSQL.

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) 9+
- **Either** [Docker Desktop](https://www.docker.com/products/docker-desktop/) (recommended for a one-command local DB) **or** [PostgreSQL](https://www.postgresql.org/) 16+ installed on your machine

## Setup

### Option A — Local database with Docker (recommended)

1. Copy the environment file (defaults match `docker-compose.yml`):

   ```bash
   cp .env.example .env
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Start Postgres and apply migrations in one step:

   ```bash
   pnpm db:bootstrap
   ```

   This runs `docker compose up -d`, waits until port `5432` is ready, then runs `prisma migrate deploy`.

4. Generate the Prisma client (also runs during `packages/database` build):

   ```bash
   pnpm db:generate
   ```

**Day to day:** `pnpm db:up` / `pnpm db:down` to start or stop the container. If something else already uses port `5432`, change the host port in `docker-compose.yml` and update `DATABASE_URL` in `.env`.

**Docker won’t connect (Windows):** If you see `dockerDesktopLinuxEngine` / `The system cannot find the file specified` / `pipe\\dockerDesktopLinuxEngine`, **Docker Desktop is not running or not installed**. Install [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/), open it, wait until it says **“Engine running”**, then run `pnpm db:bootstrap` again. WSL2 backend is required on current Docker Desktop defaults.

### Option B — Your own PostgreSQL

1. Copy `.env.example` to `.env` and set **`DATABASE_URL`** to your instance (user, password, host, port, database name).

2. `pnpm install`, then `pnpm db:migrate` (or `pnpm db:push` for schema-only dev).

3. `pnpm db:generate`

Use the **repository root** `.env` only. Root scripts load it via `dotenv-cli` and pass `DATABASE_URL` to Prisma. The value must be non-empty or Prisma will error with `P1012` / “Environment variable not found: DATABASE_URL”.

### CI (GitHub Actions)

On push/PR to `main`/`master`, **[`.github/workflows/ci.yml`](.github/workflows/ci.yml)** runs: install → `DATABASE_URL` for Postgres service → `prisma migrate deploy` → `pnpm db:generate` → `pnpm typecheck` → `pnpm build` → `pnpm lint` → `pnpm test`. The workflow sets `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/lifeos` to match the Compose defaults (no secrets required for the ephemeral service).

### One-shot local check

Equivalent to the automated gate:

```bash
pnpm check
```

(Requires root `.env` with `DATABASE_URL` for `db:generate` and Prisma.)

### Windows: Prisma engine lock

If `pnpm db:generate` or `pnpm build` fails with `EPERM` / `rename` on `query_engine-windows.dll.node`, stop the API process (`pnpm --filter @life-os/api dev` or `node dist/server.js`), run generate again, then restart the API.

### Phase 0 acceptance

After setup, follow **[`docs/PHASE_0_ACCEPTANCE.md`](docs/PHASE_0_ACCEPTANCE.md)** to verify DB, API, ingestion, brief pipeline, audit, and evidence against the blueprint pack. Run **`pnpm check`** locally to mirror CI before pushing.

### Roadmap (no overlap)

- **[`docs/NEXT_PHASE_SCOPE.md`](docs/NEXT_PHASE_SCOPE.md)** — Blueprint **0–7** baselined; focus on acceptance hardening or post-pack scope.
- **[`docs/PHASE_1_GAP_ANALYSIS.md`](docs/PHASE_1_GAP_ANALYSIS.md)** — concrete gaps vs [`02_PHASE_1_FOLLOW_THROUGH_ENGINE.md`](Life_OS_Full_Phases_0_7_Blueprint_Pack/02_PHASE_1_FOLLOW_THROUGH_ENGINE.md).

## Optional: Local LLM (hybrid)

Tier **2** (Ollama, e.g. `qwen2.5:7b`) powers **Assistant explain** on Daily Brief lines when `LLM_ENABLED=true`. Tier **1** (Python **A-S-FLC** sidecar + optional `asflc-decision` model in Ollama) screens **signals** and **note capture** when `ASFLC_ENABLED=true`. Both default **off**; see **`.env.example`**.

- Sidecar: [`apps/asflc-sidecar/README.md`](apps/asflc-sidecar/README.md)
- Print setup checklist: `node scripts/print-local-llm-setup.mjs`
- Run sidecar: `pnpm asflc-sidecar`
- API probes: `GET /api/v1/health/llm` (Settings → Local assistant)
- Audited rows: **`LlmInvocationLog`** (run migrations so the table exists)

## Run

Terminal 1 — API (default `http://127.0.0.1:3000`):

```bash
pnpm --filter @life-os/api dev
```

Terminal 2 — Web (Vite dev server, proxies `/api` to the API):

```bash
pnpm --filter @life-os/web dev
```

Or run both via Turbo:

```bash
pnpm dev
```

Open the app at `http://127.0.0.1:5173`.

## Engine scripts

After you have data (e.g. notes that create obligations), regenerate suggestions and the daily brief:

```bash
pnpm suggestions:recompute
pnpm brief:generate
```

## External memory (backup, not cloud)

- **App export:** Settings → “Download export” calls `POST /api/v1/privacy/export` and downloads a JSON snapshot suitable for copying to **USB, external SSD, or a NAS share**.
- **Full database backup:** use PostgreSQL tools on your machine, for example:

  ```bash
  pg_dump "$DATABASE_URL" -Fc -f lifeos-backup.dump
  ```

  Restore with `pg_restore` when needed. Encrypt the file at rest if it leaves your machine.

Cloud sync is **not** required for Phase 0; optional encrypted sync may come later.

## Scripts (root)

| Script | Purpose |
|--------|---------|
| `pnpm dev` | Turbo dev (API + web) |
| `pnpm build` | Production build |
| `pnpm db:up` | Start local Postgres (`docker compose up -d`) |
| `pnpm db:down` | Stop local Postgres (`docker compose down`) |
| `pnpm db:bootstrap` | Docker Postgres up → wait for port → `prisma migrate deploy` (creates `.env` from `.env.example` if missing) |
| `pnpm db:migrate` | Prisma migrate dev |
| `pnpm db:push` | Prisma db push |
| `pnpm db:generate` | Prisma generate |
| `pnpm brief:generate` | Build today’s daily brief |
| `pnpm suggestions:recompute` | Create/update suggestions from obligations |
| `pnpm asflc-sidecar` | Python FastAPI sidecar (policy guard + `/decide`) on port 8100 |
| `node scripts/print-local-llm-setup.mjs` | Print Ollama + sidecar setup steps |

## Project layout

```text
apps/web     Vite + React + Tailwind UI
apps/api     Fastify HTTP API (/api/v1)
apps/asflc-sidecar   Python FastAPI — optional Tier-1 policy guard
packages/database   Prisma + PostgreSQL
packages/shared     Pagination helpers, Zod
packages/types      Shared TS types (e.g. companion DTOs)
```

See [AGENTS.md](./AGENTS.md) and [`.cursor/rules/life-os.mdc`](.cursor/rules/life-os.mdc) for Cursor/agent constraints, blueprint references, and phase gates.
